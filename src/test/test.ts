import { pipeline, WritableAsync } from '@pieropatron/stream-async';
import { Client, ConsumeMessage } from '../index';

const config = globalThis.__CFG__;

const client = new Client(config.client);
const x_name = `x_${Date.now()}`;

const exchange = client.exchange(x_name);
const queue = client.queue(x_name);

afterAll(async () => {
	await queue.purge();
	await queue.delete();
	await exchange.delete();
});


describe("Test exchange", ()=>{
	test("Not exists exchange", async () => {
		const exists = await exchange.exists();
		expect(exists).toBe(false);
	});

	test("Declare exchange", async () => {
		await exchange.declare({
			type: 'direct',
			storage_type: 'durable'
		});
		const exists = await exchange.exists();
		expect(exists).toBe(true);
	});

	test("Bind/unbind to another exchange, autodelete exchange", async () => {
		const exchange2 = client.exchange(`x_${Date.now() }`);
		await exchange2.declare({
			type: 'direct',
			storage_type: 'auto-deleted'
		});

		const routing_key = 'test';
		const destination = exchange.name;

		const bound = await exchange2.bind({
			routing_key,
			destination
		});

		expect(bound).toBe(true);

		const unbound = await exchange2.unbind({
			routing_key,
			destination
		});

		expect(unbound).toBe(true);

		const exists = await exchange2.exists();
		expect(exists).toBe(false);
	});

	test("Delete exchange", async () => {
		const deleted = await exchange.delete();
		expect(deleted).toBe(true);
	});

	test('Exchange not exists after delete', async () => {
		const exists = await exchange.exists();
		expect(exists).toBe(false);
	});
});

describe("Test queue", ()=>{
	test("Declare exchange", async () => {
		await exchange.declare({
			type: 'direct',
			storage_type: 'durable'
		});
	});

	test("Queue not exists", async () => {
		const exists = await queue.exists();
		expect(exists).toBe(false);
	});

	test("Declare queue", async () => {
		const declared = await queue.declare({
			storage_type: 'durable'
		});
		expect(declared).toEqual({
			consumer_count: 0,
			message_count: 0,
			queue: queue.name
		});
	});

	test("Exists queue after assert", async () => {
		const exists = await queue.exists();
		expect(exists).toBe(true);
	});

	test("Stat queue", async () => {
		const stat = await queue.stat();
		expect(stat).toEqual({
			consumer_count: 0,
			message_count: 0,
			queue: queue.name
		});
	});

	test("Bind/unbind queue to auto-deleted exchange", async () => {
		const exchange = client.exchange(`x_${Date.now()}`);
		await exchange.declare({
			type: 'direct',
			storage_type: 'auto-deleted'
		});

		const routing_key = 'test';

		const bound = await queue.bind({
			routing_key,
			exchange: exchange.name
		});

		expect(bound).toBe(true);

		const unbound = await queue.unbind({
			routing_key,
			exchange: exchange.name
		});

		expect(unbound).toBe(true);

		const exists = await exchange.exists();
		expect(exists).toBe(false);
	});

	test("Purge queue", async () => {
		const purged = await queue.purge();
		expect(purged).toEqual({
			message_count: 0
		});
	});

	test("Delete queue", async () => {
		const deleted = await queue.delete();
		expect(deleted).toEqual({
			message_count: 0
		});
	});

	test('Queue not exists after delete', async () => {
		const exists = await queue.exists();
		expect(exists).toBe(false);
	});
});

const properties = { app_id: 'TEST' };
const content = 'TEST';

describe ("Test publish/consume", ()=>{
	test("Publish", async ()=>{
		// restore removed queue
		await queue.declare({
			storage_type: 'durable'
		});

		await queue.bind({exchange: x_name, routing_key: ""});

		const publisher = await client.create_publisher();
		expect(publisher.closed).toEqual(false);
		let e: any;
		try {
			await publisher.publish({
				exchange: x_name,
				routing_key: "",
				properties,
				body: Buffer.from(content)
			});
		} catch (_e){
			await publisher.close();
			e = _e;
		}

		expect(e).toBe(undefined);
		await publisher.close();
		expect(publisher.error).toEqual(null);
	});

	test("Consume", async ()=>{
		const ts = await client.consumer_transform({
			queue: x_name
		});

		let _content = "";
		let _properties: typeof properties | undefined;

		await pipeline(
			ts,
			new WritableAsync<ConsumeMessage>({
				objectMode: true,
				async write(chunk) {
					const body = chunk.body;
					if (body) {
						const buffer = await body.toBuffer();
						_content = buffer.toString('utf-8');
					}
					_properties = chunk.properties as any;
					await chunk.ack();
					ts.unsubscribe();
				}
			})
		);

		expect(_content).toEqual(content);
		expect(_properties).toEqual(properties);
	});
});
