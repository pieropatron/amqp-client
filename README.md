# amqp-client

tiny amqp 0-9-1 streamable client

Idea of this project is to provide easy of use client for work with rabbit-mq, which should allow to post and read message bodies as streams.

# Introduction
Starting to work with Rabbit MQ it is often a bit complex to understand its philosophy: how to correctly make connection, then using of channels, publish and consume messages and so on. Even if we need to do only something simple, like just read messages from one Queue of some 3rd party app, we'll had to study a lot of things about Rabbit MQ, AMQP and so on. This client (in theoury) should to allow of easy start to work with Rabbit MQ.
Another problem is that inspite of ability of Rabbit-MQ to transmit big-size messages (splitting them to chunks of liimited size), I didn't found in popular libraries for nodejs to process this correct. As I understand, they trying to cache all chunks in memory while message will not completely received, which is really not safe for nodejs and it's memory restrictions. Thats why I also added to this client ability to use message bodies as streams. In result, it should allow to save infromation, for example, to files directly after receive message chunks.

NB: This client is not well-tested yet, so, please, be careful using it!

# Install

`npm install @pieropatron/amqp-client`

OR

`npm install https://github.com/pieropatron/amqp-client`

# API

## Create client

``` ts
import {Client} from '@pieropatron/amqp-client';

// create client with default values of options
const client = new Client({
	host: '127.0.0.1',
	port: 5672,
	username: 'guest',
	password: 'guest',
	auth_mechanism: ['AMQPLAIN', 'PLAIN'],
	protocol: 'amqp:',
	channel_max: 0,
	frame_max: 0,
	heartbeat: 0,
	locale: 'en_US',
	vhost: '/',
	connection_timeout: 60000
});
```

## Work with exchanges

``` ts
// get helper to work with exchanges
const exchange = client.exchange("test");

// Create exchange if not exists
await exchange.declare({
	storage_type: 'durable',
	type: 'direct',
	alternate_exchange: '',
	internal: false
});

// Check if exchange exists
const exists: boolean = await exchange.exists();

// Bind exchange to "destination" exchange with "routing key".
const bound: boolean = await exchange.bind({
	destination: "",
	routing_key: ""
});

// Unbind exchange from "destination" exchange with "routing key".
const unbound: boolean = await exchange.unbind({
	destination: "",
	routing_key: ""
});

// Delete exchange
const deleted = await exchange.delete();
```

## Work with queues

``` ts
// get helper to work with queues
const queue = client.queue("test");

// Create queue if not exists
await queue.declare({
	storage_type: 'durable',
	queue_type: 'classic',
	private: false
});

// Check if queue exists
const exists: boolean = await queue.exists();

// Get current queue stat
const stat: {queue: string, message_count: number, consumer_count: number} = await queue.stat();

// Bind queue to exchange with "routing key".
const bound: boolean = await queue.bind({
	exchange: "",
	routing_key: ""
});

// Unbind queue from exchange with "routing key".
const unbound: boolean = await queue.unbind({
	exchange: "",
	routing_key: ""
});

// remove all messages from queue
const purged: {message_count: number} = await queue.purge();

// Delete queue
const deleted: {message_count: number} = await queue.delete();
```

## Publish messages

Structure of "Published message":
``` ts
const message = {
	properties?: {
		// MIME content type
		content_type?: string,
		// MIME content encoding
		content_encoding?: string,
		// For applications, and for header exchange routing
		headers?: object,
		/**
		 * For queues that implement persistence:
		 * non-persistent (1) or persistent (2)
		 */
		delivery_mode?: number,
		// message priority, 0 to 9
		priority?: number,
		// For application use, correlation identifier
		correlation_id?: string,
		// address to reply to
		reply_to?: string,
		// message expiration specification
		expiration?: string,
		// application message identifier
		message_id?: string,
		// message timestamp
		timestamp?: Date,
		// For application use, message type name
		type?: string,
		// creating user id
		user_id?: string,
		// application id
		app_id?: string
	},
	// name of exchange to publish
	exchange?: string,
	// routing key to publish
	routing_key?: string,
	// callback which is called after current message will published
	callback?: (error?: Error | null, result?: {delivery_tag: bigint, multiple: boolean}) => void,
	// optional body to publish
	body?: Readable | Buffer,
	// size of body, required for case when body is stream
	body_size
}
```
There are 2 ways for publishing messages in the client:
1. Using writable publisher stream
2. Using publisher helper

Examples:
``` ts
import {ReadableAsync, pipeline} from '@pieropatron/stream-async';
import {createReadStream} from 'fs';
import {Client, PublishMessage} from '@pieropatron/amqp-client';

// publish using streams:
const rs = new ReadableAsync<PublishMessage>;
await rs.pushAsync({
	body: createReadStream(__dirname + '/big.avi'),
	callback: (error, result)=>{
		console.log(error, result);
		rs.push(null);
	}
});

const publish_writable = await client.publish_writable();
await pipeline(rs, publish_writable);

// publish using helper:
const publisher = await client.create_publisher();
await publisher.publish({
	body: createReadStream(__dirname + '/big.avi'),
	callback: (error, result)=>{
		console.log(error, result);
	}
});
```

## Consume messages

Structure of "Consume message":

``` ts
const message = {
	// tag of consumer
    	consumer_tag: string,
    	// unique (for consumer) delivery number
    	delivery_tag: bigint,
	// is message redeliveried
    	redelivered: boolean,
	// name of source exchange
    	exchange: string,
	// delivery routing key
    	routing_key: string,
	// same properties structure as for Publish message
	properties?: {},
	// Readable stream, with additional method toBuffer (for easy get content, if required)
	body?: ConsumerBodyReadable,
	// size of body
	body_size?: number,
	// Method to call if message was processed well
	ack: ()=>Promise<void>,
	// Method to call if message was processed bad
	nack: (requeue: boolean)=>Promise<void>
}
```

NB: for message it is mandatory to call ack or nack after the process!

Example:
``` ts
import {ConsumeMessage} from '@pieropatron/amqp-client';
import {WritableAsync, pipeline} from '@pieropatron/stream-async';

const consumer_transform = await client.consumer_transform({
	/** Queue for consume */
	queue: string,
	/** Prefetch count of messages */
	prefetch_count: number,
	/** Do not receive messages from same connection */
	no_local: boolean,
	/** Identifier for the consumer */
	consumer_tag: string,
	/** In case of set, only this consumer can access the queue. */
	exclusive: boolean,
	/** Priority of consumer. Can be positive or negative. */
	priority: number,
	// Any other supported consume arguments
	custom: Record<string, any>
});

await pipeline(
	consumer_transform,
	new WritableAsync<ConsumeMessage>({
		async write(chunk: ConsumeMessage){
			if (chunk.body){
				const buffer = await chunk.body.toBuffer();
				console.log(buffer.toString());
				await chunk.ack();
			} else {
				await chunk.nack(false);
			}
		}
	})
);
```

That's all for this client. Hope, it will be usefull for you.
