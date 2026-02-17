import { Query } from 'teamspeak3.js';

require('dotenv').config();

const host = process.env.TEAMSPEAK_HOST || 'localhost';
const port = Number(process.env.TEAMSPEAK_QUERY_PORT || '10011');

console.debug(`TeamSpeak query using host=${host} port=${port}`);

const query = new Query({ host, port });

// Prevent unhandled 'error' events from crashing the process
query.on('error', (err: any) => {
    console.error('TeamSpeak query error:', err);
});

export async function getTree() {
    try {
        // Connect/login on demand so callers always get the current state
        if (!(query as any).connected) {

            await query.connect();
            // Verbinden als Henahax, TODO: fix
            await query.login('query', process.env.TEAMSPEAK_PASSWORD || 'defaultPassword');
            await query.virtualServers.use(1);
        }

        const channels = Array.from((await query.channels.fetch()).values());
        const clients = Array.from((await query.clients.fetch()).values());

        if (!channels.length) {
            return [];
        }

        const channelMap = new Map<number, any>();

        // Init channels
        channels.forEach(ch => {
            // Channel objects expose `id` and `parentId` (not `cid`)
            channelMap.set(ch.id, {
                id: ch.id,
                name: ch.name,
                order: ch.order,
                parentId: ch.parentId,
                subchannels: [],
                clients: []
            });
        });

        // Assign clients to channels - clients use `channelId` and `id`
        clients.forEach(client => {
            const chanId = client.channelId;
            if (chanId && channelMap.has(chanId) && client.type === 0) { // type 0 = regular client
                channelMap.get(chanId).clients.push({
                    id: client.id,
                    nickname: client.nickname
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
        const sortGroup = (group: any[]) => {
            const sorted: any[] = [];
            const remaining = new Set(group.map(g => g.id));

            // First element = order === 0
            let current = group.find(c => Number(c.order) === 0);

            // If none has order 0 (edge case), fall back to numeric sort
            if (!current) {
                return group.slice().sort((a, b) => Number(a.order) - Number(b.order));
            }

            while (current) {
                sorted.push(current);
                remaining.delete(current.id);
                current = group.find(c => Number(c.order) === current.id);
            }

            // Append any leftover channels (cycles or missing links) sorted by numeric order
            if (remaining.size) {
                const leftovers = group.filter(g => remaining.has(g.id));
                leftovers.sort((a, b) => Number(a.order) - Number(b.order));
                sorted.push(...leftovers);
            }

            return sorted;
        };

        // Recursively build tree
        const buildTree = (parentId = 0): any[] => {
            const group = byParent.get(parentId);
            if (!group) return [];

            const sorted = sortGroup(group);

            return sorted.map(channel => ({
                ...channel,
                subchannels: buildTree(channel.id)
            }));
        };

        const tree = buildTree(0);

        return tree;

    } catch (error) {
        console.error('Failed to fetch TeamSpeak query data:', error);
        return [];
    }
}
