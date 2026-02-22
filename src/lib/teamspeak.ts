require('dotenv').config();

// Type definitions for TeamSpeak API responses
interface TeamspeakChannel {
    cid?: string | number;
    id?: string | number;
    cname?: string;
    name?: string;
    cpid?: string | number;
    parentId?: string | number;
    channel_order?: string | number;
    order?: string | number;
}

interface TeamspeakClient {
    cid?: string | number;
    channelId?: string | number;
    clid?: string | number;
    id?: string | number;
    client_type?: number;
    type?: number;
    client_nickname?: string;
    nickname?: string;
}

// TeamSpeak Web API configuration
const TEAMSPEAK_BASE_URL = process.env.TEAMSPEAK_BASE_URL || 'http://localhost';
const TEAMSPEAK_QUERY_PORT = process.env.TEAMSPEAK_QUERY_PORT || '10080';
const TEAMSPEAK_API_KEY = process.env.TEAMSPEAK_API_KEY || '';
const TEAMSPEAK_SERVER_ID = process.env.TEAMSPEAK_SERVER_ID || '1';

// Simple in-memory cache + inflight dedupe
let cachedTree: { tree: any; ts: number } | null = null;
let inflightFetch: Promise<any> | null = null;

const CACHE_TTL = Number(process.env.TEAMSPEAK_CACHE_TTL_MS ?? process.env.TEAMSPEAK_CACHE_TTL ?? '60000');

async function fetchChannels() {
    try {
        const response = await fetch(`${TEAMSPEAK_BASE_URL}:${TEAMSPEAK_QUERY_PORT}/${TEAMSPEAK_SERVER_ID}/channellist?api-key=${TEAMSPEAK_API_KEY}`, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch channels: ${response.statusText}`);
        }

        const data = await response.json();
        return Array.isArray(data) ? data : data.channels || [];
    } catch (error) {
        console.error('Error fetching TeamSpeak channels:', error);
        return [];
    }
}

async function fetchClients() {
    try {
        const response = await fetch(`${TEAMSPEAK_BASE_URL}:${TEAMSPEAK_QUERY_PORT}/${TEAMSPEAK_SERVER_ID}/clientlist?api-key=${TEAMSPEAK_API_KEY}`, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch clients: ${response.statusText}`);
        }

        const data = await response.json();
        return Array.isArray(data) ? data : data.clients || [];
    } catch (error) {
        console.error('Error fetching TeamSpeak clients:', error);
        return [];
    }
}

async function fetchTreeFromServer() {
    const channels = await fetchChannels();
    const clients = await fetchClients();

    if (!channels.length) {
        return [];
    }

    const channelMap = new Map<number, any>();

    // Init channels
    channels.forEach((ch: TeamspeakChannel) => {
        // Web API uses: cid, cname, cpid, channel_order
        const rawChannelId = ch.cid ?? ch.id;
        if (rawChannelId == null) return; // skip malformed entries
        const channelId = Number(rawChannelId);
        if (Number.isNaN(channelId)) return;

        const rawParent = ch.cpid ?? ch.parentId;
        const parentId = (rawParent == null || rawParent === '0') ? 0 : Number(rawParent);

        channelMap.set(channelId, {
            id: channelId,
            name: ch.cname || ch.name || '',
            order: Number(ch.channel_order ?? ch.order ?? 0),
            parentId: parentId,
            subchannels: [],
            clients: []
        });
    });

    // Assign clients to channels
    clients.forEach((client: TeamspeakClient) => {
        // Web API uses: cid (channel id), clid (client id), client_nickname
        const rawChanId = client.cid ?? client.channelId;
        if (rawChanId == null) return;
        const chanIdNum = Number(rawChanId);
        const clientType = client.client_type ?? client.type ?? 0;

        if (!Number.isNaN(chanIdNum) && channelMap.has(chanIdNum) && clientType === 0) {
            const clientId = client.clid ?? client.id;
            channelMap.get(chanIdNum).clients.push({
                id: clientId == null ? null : (Number(clientId) || clientId),
                nickname: client.client_nickname || client.nickname || ''
            });
        }
    });

    // Build hierarchy using TS3 linked-list `order` logic.
    const byParent = new Map<number, any[]>();

    // Group channels by parent
    channelMap.forEach(channel => {
        const parentId = channel.parentId ?? 0;

        if (!byParent.has(parentId)) {
            byParent.set(parentId, []);
        }

        byParent.get(parentId)!.push(channel);
    });

    // Sort a group using TS3 linked-list ordering
    const sortGroup = (group: any[]): any[] => {
        const sorted: any[] = [];
        const remaining = new Set(group.map((g: any) => g.id));

        // First element = order === 0
        let current = group.find((c: any) => Number(c.order) === 0);

        // If none has order 0 (edge case), fall back to numeric sort
        if (!current) {
            return group.slice().sort((a, b) => Number(a.order) - Number(b.order));
        }

        while (current) {
            sorted.push(current);
            remaining.delete(current.id);
            current = group.find((c: any) => Number(c.order) === current.id);
        }

        // Append any leftover channels (cycles or missing links) sorted by numeric order
        if (remaining.size) {
            const leftovers = group.filter((g: any) => remaining.has(g.id));
            leftovers.sort((a, b) => Number(a.order) - Number(b.order));
            sorted.push(...leftovers);
        }

        return sorted;
    };

    // Recursively build tree
    const buildTree = (parentId: number = 0): any[] => {
        const group = byParent.get(parentId);
        if (!group) return [];

        const sorted = sortGroup(group);

        return sorted.map((channel: any) => ({
            ...channel,
            subchannels: buildTree(channel.id)
        }));
    };

    const tree = buildTree(0);

    return tree;
}

export async function getTree() {
    // Return cached value if still fresh
    if (cachedTree && (Date.now() - cachedTree.ts) < CACHE_TTL) {
        return cachedTree.tree;
    }

    // Deduplicate concurrent fetches
    if (inflightFetch) {
        try {
            return await inflightFetch;
        } catch (err: unknown) {
            // If inflight failed and we have cached data, return it
            if (cachedTree) return cachedTree.tree;
            console.error('Failed inflight fetch:', err);
            return [];
        }
    }

    inflightFetch = (async () => {
        try {
            const tree = await fetchTreeFromServer();
            cachedTree = { tree, ts: Date.now() };
            return tree;
        } finally {
            inflightFetch = null;
        }
    })();

    try {
        return await inflightFetch;
    } catch (error: unknown) {
        console.error('Failed to fetch TeamSpeak query data:', error);
        if (cachedTree) return cachedTree.tree;
        return [];
    }
}
