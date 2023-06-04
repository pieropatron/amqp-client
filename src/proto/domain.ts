/**
 * @comment
 * 
 * ======================================================
 * ==       DOMAIN TYPES
 * ======================================================
 * 
 */

export const DOMAIN = {
	class_id: {
		type: "short"
	},
	/**
	 * @doc
	 * Identifier for the consumer, valid within the current channel.
	 * @label
	 * consumer tag
	 */
	consumer_tag: {
		type: "shortstr"
	},
	/**
	 * @doc
	 * The server-assigned and channel-specific delivery tag
	 * @label
	 * server-assigned delivery tag
	 * @rule
	 * + @name channel-local
	 * + @doc
	 * + The delivery tag is valid only within the channel from which the message was
	 * + received. I.e. a client MUST NOT receive a message on one channel and then
	 * + acknowledge it on another.
	 * @rule
	 * + @name non-zero
	 * + @doc
	 * + The server MUST NOT use a zero value for delivery tags. Zero is reserved
	 * + for client use, meaning "all messages so far received".
	 */
	delivery_tag: {
		type: "longlong"
	},
	/**
	 * @doc
	 * The exchange name is a client-selected string that identifies the exchange for
	 * publish methods.
	 * @label
	 * exchange name
	 */
	exchange_name: {
		type: "shortstr",
		assert: [
			{
				check: "length",
				value: 127
			},
			{
				check: "regexp",
				value: "^[a-zA-Z0-9-_.:]*$"
			}
		]
	},
	method_id: {
		type: "short"
	},
	/**
	 * @doc
	 * If this field is set the server does not expect acknowledgements for
	 * messages. That is, when a message is delivered to the client the server
	 * assumes the delivery will succeed and immediately dequeues it. This
	 * functionality may increase performance but at the cost of reliability.
	 * Messages can get lost if a client dies before they are delivered to the
	 * application.
	 * @label
	 * no acknowledgement needed
	 */
	no_ack: {
		type: "bit"
	},
	/**
	 * @doc
	 * If the no-local field is set the server will not send messages to the connection that
	 * published them.
	 * @label
	 * do not deliver own messages
	 */
	no_local: {
		type: "bit"
	},
	/**
	 * @doc
	 * If set, the server will not respond to the method. The client should not wait
	 * for a reply method. If the server could not complete the method it will raise a
	 * channel or connection exception.
	 * @label
	 * do not send reply method
	 */
	no_wait: {
		type: "bit"
	},
	/**
	 * @doc
	 * Unconstrained.
	 */
	path: {
		type: "shortstr",
		assert: [
			{
				check: "notnull"
			},
			{
				check: "length",
				value: 127
			}
		]
	},
	/**
	 * @doc
	 * This table provides a set of peer properties, used for identification, debugging,
	 * and general information.
	 */
	peer_properties: {
		type: "table"
	},
	/**
	 * @doc
	 * The queue name identifies the queue within the vhost.  In methods where the queue
	 * name may be blank, and that has no specific significance, this refers to the
	 * 'current' queue for the channel, meaning the last queue that the client declared
	 * on the channel.  If the client did not declare a queue, and the method needs a
	 * queue name, this will result in a 502 (syntax error) channel exception.
	 * @label
	 * queue name
	 */
	queue_name: {
		type: "shortstr",
		assert: [
			{
				check: "length",
				value: 127
			},
			{
				check: "regexp",
				value: "^[a-zA-Z0-9-_.:]*$"
			}
		]
	},
	/**
	 * @doc
	 * This indicates that the message has been previously delivered to this or
	 * another client.
	 * @label
	 * message is being redelivered
	 * @rule
	 * + @name implementation
	 * + @doc
	 * + The server SHOULD try to signal redelivered messages when it can. When
	 * + redelivering a message that was not successfully acknowledged, the server
	 * + SHOULD deliver it to the original client if possible.
	 * + @scenario
	 * + Declare a shared queue and publish a message to the queue.  Consume the
	 * + message using explicit acknowledgements, but do not acknowledge the
	 * + message.  Close the connection, reconnect, and consume from the queue
	 * + again.  The message should arrive with the redelivered flag set.
	 * @rule
	 * + @name hinting
	 * + @doc
	 * + The client MUST NOT rely on the redelivered field but should take it as a
	 * + hint that the message may already have been processed. A fully robust
	 * + client must be able to track duplicate received messages on non-transacted,
	 * + and locally-transacted channels.
	 */
	redelivered: {
		type: "bit"
	},
	/**
	 * @doc
	 * The number of messages in the queue, which will be zero for newly-declared
	 * queues. This is the number of messages present in the queue, and committed
	 * if the channel on which they were published is transacted, that are not
	 * waiting acknowledgement.
	 * @label
	 * number of messages in queue
	 */
	message_count: {
		type: "long"
	},
	/**
	 * @doc
	 * The reply code. The AMQ reply codes are defined as constants at the start
	 * of this formal specification.
	 * @label
	 * reply code from server
	 */
	reply_code: {
		type: "short",
		assert: [
			{
				check: "notnull"
			}
		]
	},
	/**
	 * @doc
	 * The localised reply text. This text can be logged as an aid to resolving
	 * issues.
	 * @label
	 * localised reply text
	 */
	reply_text: {
		type: "shortstr",
		assert: [
			{
				check: "notnull"
			}
		]
	},
	/**
	 * @comment
	 * Elementary domains
	 * @label
	 * single bit
	 */
	bit: {
		type: "bit"
	},
	/**
	 * @label
	 * single octet
	 */
	octet: {
		type: "octet"
	},
	/**
	 * @label
	 * 16-bit integer
	 */
	short: {
		type: "short"
	},
	/**
	 * @label
	 * 32-bit integer
	 */
	long: {
		type: "long"
	},
	/**
	 * @label
	 * 64-bit integer
	 */
	longlong: {
		type: "longlong"
	},
	/**
	 * @label
	 * short string (max. 256 characters)
	 */
	shortstr: {
		type: "shortstr"
	},
	/**
	 * @label
	 * long string
	 */
	longstr: {
		type: "longstr"
	},
	/**
	 * @label
	 * 64-bit timestamp
	 */
	timestamp: {
		type: "timestamp"
	},
	/**
	 * @label
	 * field table
	 */
	table: {
		type: "table"
	}
};

