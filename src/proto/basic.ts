/**
 * @comment
 * ==  BASIC  ============================================================
 * @doc
 * The Basic class provides methods that support an industry-standard messaging model.
 * @grammar
 * basic               = C:QOS S:QOS-OK
 * / C:CONSUME S:CONSUME-OK
 * / C:CANCEL S:CANCEL-OK
 * / C:PUBLISH content
 * / S:RETURN content
 * / S:DELIVER content
 * / C:GET ( S:GET-OK content / S:GET-EMPTY )
 * / C:ACK
 * / S:ACK
 * / C:REJECT
 * / C:NACK
 * / S:NACK
 * / C:RECOVER-ASYNC
 * / C:RECOVER S:RECOVER-OK
 * @label
 * work with basic content
 * @chassis
 * server: MUST, client: MAY
 * @rule
 * + @name 1
 * + @doc
 * + The server SHOULD respect the persistent property of basic messages and
 * + SHOULD make a best-effort to hold persistent basic messages on a reliable
 * + storage mechanism.
 * + @scenario
 * + Send a persistent message to queue, stop server, restart server and then
 * + verify whether message is still present.  Assumes that queues are durable.
 * + Persistence without durable queues makes no sense.
 * @rule
 * + @name 2
 * + @doc
 * + The server MUST NOT discard a persistent basic message in case of a queue
 * + overflow.
 * + @scenario
 * + Declare a queue overflow situation with persistent messages and verify that
 * + messages do not get lost (presumably the server will write them to disk).
 * @rule
 * + @name 3
 * + @doc
 * + The server MAY use the Channel.Flow method to slow or stop a basic message
 * + publisher when necessary.
 * + @scenario
 * + Declare a queue overflow situation with non-persistent messages and verify
 * + whether the server responds with Channel.Flow or not. Repeat with persistent
 * + messages.
 * @rule
 * + @name 4
 * + @doc
 * + The server MAY overflow non-persistent basic messages to persistent
 * + storage.
 * @rule
 * + @name 5
 * + @doc
 * + The server MAY discard or dead-letter non-persistent basic messages on a
 * + priority basis if the queue size exceeds some configured limit.
 * @rule
 * + @name 6
 * + @doc
 * + The server MUST implement at least 2 priority levels for basic messages,
 * + where priorities 0-4 and 5-9 are treated as two distinct levels.
 * + @scenario
 * + Send a number of priority 0 messages to a queue. Send one priority 9
 * + message.  Consume messages from the queue and verify that the first message
 * + received was priority 9.
 * @rule
 * + @name 7
 * + @doc
 * + The server MAY implement up to 10 priority levels.
 * + @scenario
 * + Send a number of messages with mixed priorities to a queue, so that all
 * + priority values from 0 to 9 are exercised. A good scenario would be ten
 * + messages in low-to-high priority.  Consume from queue and verify how many
 * + priority levels emerge.
 * @rule
 * + @name 8
 * + @doc
 * + The server MUST deliver messages of the same priority in order irrespective of
 * + their individual persistence.
 * + @scenario
 * + Send a set of messages with the same priority but different persistence
 * + settings to a queue.  Consume and verify that messages arrive in same order
 * + as originally published.
 * @rule
 * + @name 9
 * + @doc
 * + The server MUST support un-acknowledged delivery of Basic content, i.e.
 * + consumers with the no-ack field set to TRUE.
 * @rule
 * + @name 10
 * + @doc
 * + The server MUST support explicitly acknowledged delivery of Basic content,
 * + i.e. consumers with the no-ack field set to FALSE.
 * + @scenario
 * + Declare a queue and a consumer using explicit acknowledgements.  Publish a
 * + set of messages to the queue.  Consume the messages but acknowledge only
 * + half of them.  Disconnect and reconnect, and consume from the queue.
 * + Verify that the remaining messages are received.
 */

export const BASIC = {
	name: "basic",
	handler: "channel",
	index: 60,
	field: {
		/**
		 * @comment
		 * These are the properties for a Basic content
		 * @comment
		 * MIME typing
		 * @label
		 * MIME content type
		 */
		content_type: {
			domain: "shortstr"
		},
		/**
		 * @comment
		 * MIME typing
		 * @label
		 * MIME content encoding
		 */
		content_encoding: {
			domain: "shortstr"
		},
		/**
		 * @comment
		 * For applications, and for header exchange routing
		 * @label
		 * message header field table
		 */
		headers: {
			domain: "table"
		},
		/**
		 * @comment
		 * For queues that implement persistence
		 * @label
		 * non-persistent (1) or persistent (2)
		 */
		delivery_mode: {
			domain: "octet"
		},
		/**
		 * @comment
		 * For queues that implement priorities
		 * @label
		 * message priority, 0 to 9
		 */
		priority: {
			domain: "octet"
		},
		/**
		 * @comment
		 * For application use, no formal behaviour
		 * @label
		 * application correlation identifier
		 */
		correlation_id: {
			domain: "shortstr"
		},
		/**
		 * @comment
		 * For application use, no formal behaviour but may hold the
		 * name of a private response queue, when used in request messages
		 * @label
		 * address to reply to
		 */
		reply_to: {
			domain: "shortstr"
		},
		/**
		 * @comment
		 * For implementation use, no formal behaviour
		 * @label
		 * message expiration specification
		 */
		expiration: {
			domain: "shortstr"
		},
		/**
		 * @comment
		 * For application use, no formal behaviour
		 * @label
		 * application message identifier
		 */
		message_id: {
			domain: "shortstr"
		},
		/**
		 * @comment
		 * For application use, no formal behaviour
		 * @label
		 * message timestamp
		 */
		timestamp: {
			domain: "timestamp"
		},
		/**
		 * @comment
		 * For application use, no formal behaviour
		 * @label
		 * message type name
		 */
		type: {
			domain: "shortstr"
		},
		/**
		 * @comment
		 * For application use, no formal behaviour
		 * @label
		 * creating user id
		 */
		user_id: {
			domain: "shortstr"
		},
		/**
		 * @comment
		 * For application use, no formal behaviour
		 * @label
		 * creating application id
		 */
		app_id: {
			domain: "shortstr"
		},
		/**
		 * @comment
		 * Deprecated, was old cluster-id property
		 * @label
		 * reserved, must be empty
		 */
		reserved: {
			domain: "shortstr"
		}
	},
	method: {
		/**
		 * @comment
		 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
		 * @doc
		 * This method requests a specific quality of service. The QoS can be specified for the
		 * current channel or for all channels on the connection. The particular properties and
		 * semantics of a qos method always depend on the content class semantics. Though the
		 * qos method could in principle apply to both peers, it is currently meaningful only
		 * for the server.
		 * @label
		 * specify quality of service
		 * @chassis
		 * server: MUST
		 */
		qos: {
			synchronous: 1,
			index: 10,
			field: {
				prefetch_size: {
					domain: "long"
				},
				prefetch_count: {
					domain: "short"
				},
				global: {
					domain: "bit"
				}
			},
			response: [
				{
					name: "qos-ok"
				}
			]
		},
		/**
		 * @doc
		 * This method tells the client that the requested QoS levels could be handled by the
		 * server. The requested QoS applies to all active consumers until a new QoS is
		 * defined.
		 * @label
		 * confirm the requested qos
		 * @chassis
		 * client: MUST
		 */
		qos_ok: {
			synchronous: 1,
			index: 11
		},
		/**
		 * @comment
		 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
		 * @doc
		 * This method asks the server to start a "consumer", which is a transient request for
		 * messages from a specific queue. Consumers last as long as the channel they were
		 * declared on, or until the client cancels them.
		 * @label
		 * start a queue consumer
		 * @chassis
		 * server: MUST
		 * @rule
		 * + @name 1
		 * + @doc
		 * + The server SHOULD support at least 16 consumers per queue, and ideally, impose
		 * + no limit except as defined by available resources.
		 * + @scenario
		 * + Declare a queue and create consumers on that queue until the server closes the
		 * + connection. Verify that the number of consumers created was at least sixteen
		 * + and report the total number.
		 */
		consume: {
			synchronous: 1,
			index: 20,
			field: {
				/**
				 * @comment
				 * Deprecated: "ticket", must be zero
				 */
				reserved_1: {
					type: "short",
					reserved: 1
				},
				queue: {
					domain: "queue-name"
				},
				consumer_tag: {
					domain: "consumer-tag"
				},
				no_local: {
					domain: "no-local"
				},
				no_ack: {
					domain: "no-ack"
				},
				exclusive: {
					domain: "bit"
				},
				no_wait: {
					domain: "no-wait"
				},
				arguments: {
					domain: "table"
				}
			},
			response: [
				{
					name: "consume-ok"
				}
			]
		},
		/**
		 * @doc
		 * The server provides the client with a consumer tag, which is used by the client
		 * for methods called on the consumer at a later stage.
		 * @label
		 * confirm a new consumer
		 * @chassis
		 * client: MUST
		 */
		consume_ok: {
			synchronous: 1,
			index: 21,
			field: {
				consumer_tag: {
					domain: "consumer-tag"
				}
			}
		},
		/**
		 * @comment
		 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
		 * @doc
		 * This method cancels a consumer. This does not affect already delivered
		 * messages, but it does mean the server will not send any more messages for
		 * that consumer. The client may receive an arbitrary number of messages in
		 * between sending the cancel method and receiving the cancel-ok reply.
		 * 
		 * It may also be sent from the server to the client in the event
		 * of the consumer being unexpectedly cancelled (i.e. cancelled
		 * for any reason other than the server receiving the
		 * corresponding basic.cancel from the client). This allows
		 * clients to be notified of the loss of consumers due to events
		 * such as queue deletion. Note that as it is not a MUST for
		 * clients to accept this method from the server, it is advisable
		 * for the broker to be able to identify those clients that are
		 * capable of accepting the method, through some means of
		 * capability negotiation.
		 * @label
		 * end a queue consumer
		 * @chassis
		 * server: MUST, client: SHOULD
		 * @rule
		 * + @name 1
		 * + @doc
		 * + If the queue does not exist the server MUST ignore the cancel method, so
		 * + long as the consumer tag is valid for that channel.
		 * + @scenario
		 * + TODO.
		 */
		cancel: {
			synchronous: 1,
			index: 30,
			field: {
				consumer_tag: {
					domain: "consumer-tag"
				},
				no_wait: {
					domain: "no-wait"
				}
			},
			response: [
				{
					name: "cancel-ok"
				}
			]
		},
		/**
		 * @doc
		 * This method confirms that the cancellation was completed.
		 * @label
		 * confirm a cancelled consumer
		 * @chassis
		 * client: MUST, server: MAY
		 */
		cancel_ok: {
			synchronous: 1,
			index: 31,
			field: {
				consumer_tag: {
					domain: "consumer-tag"
				}
			}
		},
		/**
		 * @comment
		 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
		 * @doc
		 * This method publishes a message to a specific exchange. The message will be routed
		 * to queues as defined by the exchange configuration and distributed to any active
		 * consumers when the transaction, if any, is committed.
		 * @label
		 * publish a message
		 * @chassis
		 * server: MUST
		 */
		publish: {
			content: 1,
			index: 40,
			field: {
				/**
				 * @comment
				 * Deprecated: "ticket", must be zero
				 */
				reserved_1: {
					type: "short",
					reserved: 1
				},
				exchange: {
					domain: "exchange-name"
				},
				routing_key: {
					domain: "shortstr"
				},
				mandatory: {
					domain: "bit"
				},
				immediate: {
					domain: "bit"
				}
			}
		},
		/**
		 * @doc
		 * This method returns an undeliverable message that was published with the "immediate"
		 * flag set, or an unroutable message published with the "mandatory" flag set. The
		 * reply code and text provide information about the reason that the message was
		 * undeliverable.
		 * @label
		 * return a failed message
		 * @chassis
		 * client: MUST
		 */
		return: {
			content: 1,
			index: 50,
			field: {
				reply_code: {
					domain: "reply-code"
				},
				reply_text: {
					domain: "reply-text"
				},
				exchange: {
					domain: "exchange-name"
				},
				routing_key: {
					domain: "shortstr"
				}
			}
		},
		/**
		 * @comment
		 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
		 * @doc
		 * This method delivers a message to the client, via a consumer. In the asynchronous
		 * message delivery model, the client starts a consumer using the Consume method, then
		 * the server responds with Deliver methods as and when messages arrive for that
		 * consumer.
		 * @label
		 * notify the client of a consumer message
		 * @chassis
		 * client: MUST
		 * @rule
		 * + @name 1
		 * + @doc
		 * + The server SHOULD track the number of times a message has been delivered to
		 * + clients and when a message is redelivered a certain number of times - e.g. 5
		 * + times - without being acknowledged, the server SHOULD consider the message to be
		 * + unprocessable (possibly causing client applications to abort), and move the
		 * + message to a dead letter queue.
		 * + @scenario
		 * + TODO.
		 */
		deliver: {
			content: 1,
			index: 60,
			field: {
				consumer_tag: {
					domain: "consumer-tag"
				},
				delivery_tag: {
					domain: "delivery-tag"
				},
				redelivered: {
					domain: "redelivered"
				},
				exchange: {
					domain: "exchange-name"
				},
				routing_key: {
					domain: "shortstr"
				}
			}
		},
		/**
		 * @comment
		 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
		 * @doc
		 * This method provides a direct access to the messages in a queue using a synchronous
		 * dialogue that is designed for specific types of application where synchronous
		 * functionality is more important than performance.
		 * @label
		 * direct access to a queue
		 * @chassis
		 * server: MUST
		 */
		get: {
			synchronous: 1,
			index: 70,
			field: {
				/**
				 * @comment
				 * Deprecated: "ticket", must be zero
				 */
				reserved_1: {
					type: "short",
					reserved: 1
				},
				queue: {
					domain: "queue-name"
				},
				no_ack: {
					domain: "no-ack"
				}
			},
			response: [
				{
					name: "get-ok"
				},
				{
					name: "get-empty"
				}
			]
		},
		/**
		 * @doc
		 * This method delivers a message to the client following a get method. A message
		 * delivered by 'get-ok' must be acknowledged unless the no-ack option was set in the
		 * get method.
		 * @label
		 * provide client with a message
		 * @chassis
		 * client: MAY
		 */
		get_ok: {
			synchronous: 1,
			content: 1,
			index: 71,
			field: {
				delivery_tag: {
					domain: "delivery-tag"
				},
				redelivered: {
					domain: "redelivered"
				},
				exchange: {
					domain: "exchange-name"
				},
				routing_key: {
					domain: "shortstr"
				},
				message_count: {
					domain: "message-count"
				}
			}
		},
		/**
		 * @doc
		 * This method tells the client that the queue has no messages available for the
		 * client.
		 * @label
		 * indicate no messages available
		 * @chassis
		 * client: MAY
		 */
		get_empty: {
			synchronous: 1,
			index: 72,
			field: {
				/**
				 * @comment
				 * Deprecated: "cluster-id", must be empty
				 */
				reserved_1: {
					type: "shortstr",
					reserved: 1
				}
			}
		},
		/**
		 * @comment
		 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
		 * @doc
		 * When sent by the client, this method acknowledges one or more
		 * messages delivered via the Deliver or Get-Ok methods.
		 * 
		 * When sent by server, this method acknowledges one or more
		 * messages published with the Publish method on a channel in
		 * confirm mode.
		 * 
		 * The acknowledgement can be for a single message or a set of
		 * messages up to and including a specific message.
		 * @label
		 * acknowledge one or more messages
		 * @chassis
		 * server: MUST, client: MUST
		 */
		ack: {
			index: 80,
			field: {
				delivery_tag: {
					domain: "delivery-tag"
				},
				multiple: {
					domain: "bit"
				}
			}
		},
		/**
		 * @comment
		 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
		 * @doc
		 * This method allows a client to reject a message. It can be used to interrupt and
		 * cancel large incoming messages, or return untreatable messages to their original
		 * queue.
		 * @label
		 * reject an incoming message
		 * @chassis
		 * server: MUST
		 * @rule
		 * + @name 1
		 * + @doc
		 * + The server SHOULD be capable of accepting and process the Reject method while
		 * + sending message content with a Deliver or Get-Ok method. I.e. the server should
		 * + read and process incoming methods while sending output frames. To cancel a
		 * + partially-send content, the server sends a content body frame of size 1 (i.e.
		 * + with no data except the frame-end octet).
		 * @rule
		 * + @name 2
		 * + @doc
		 * + The server SHOULD interpret this method as meaning that the client is unable to
		 * + process the message at this time.
		 * + @scenario
		 * + TODO.
		 * @rule
		 * + @name 3
		 * + @doc
		 * + The client MUST NOT use this method as a means of selecting messages to process.
		 * + @scenario
		 * + TODO.
		 */
		reject: {
			index: 90,
			field: {
				delivery_tag: {
					domain: "delivery-tag"
				},
				requeue: {
					domain: "bit"
				}
			}
		},
		/**
		 * @comment
		 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
		 * @doc
		 * This method asks the server to redeliver all unacknowledged messages on a
		 * specified channel. Zero or more messages may be redelivered.  This method
		 * is deprecated in favour of the synchronous Recover/Recover-Ok.
		 * @label
		 * redeliver unacknowledged messages
		 * @chassis
		 * server: MAY
		 * @rule
		 * + @name 1
		 * + @doc
		 * + The server MUST set the redelivered flag on all messages that are resent.
		 * + @scenario
		 * + TODO.
		 */
		recover_async: {
			index: 100,
			deprecated: 1,
			field: {
				requeue: {
					domain: "bit"
				}
			}
		},
		/**
		 * @comment
		 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
		 * @doc
		 * This method asks the server to redeliver all unacknowledged messages on a
		 * specified channel. Zero or more messages may be redelivered.  This method
		 * replaces the asynchronous Recover.
		 * @label
		 * redeliver unacknowledged messages
		 * @chassis
		 * server: MUST
		 * @rule
		 * + @name 1
		 * + @doc
		 * + The server MUST set the redelivered flag on all messages that are resent.
		 * + @scenario
		 * + TODO.
		 */
		recover: {
			index: 110,
			field: {
				requeue: {
					domain: "bit"
				}
			}
		},
		/**
		 * @doc
		 * This method acknowledges a Basic.Recover method.
		 * @label
		 * confirm recovery
		 * @chassis
		 * client: MUST
		 */
		recover_ok: {
			synchronous: 1,
			index: 111
		},
		/**
		 * @doc
		 * This method allows a client to reject one or more incoming messages. It can be
		 * used to interrupt and cancel large incoming messages, or return untreatable
		 * messages to their original queue.
		 * 
		 * This method is also used by the server to inform publishers on channels in
		 * confirm mode of unhandled messages.  If a publisher receives this method, it
		 * probably needs to republish the offending messages.
		 * @label
		 * reject one or more incoming messages
		 * @chassis
		 * server: MUST, client: MUST
		 * @rule
		 * + @name 1
		 * + @doc
		 * + The server SHOULD be capable of accepting and processing the Nack method while
		 * + sending message content with a Deliver or Get-Ok method. I.e. the server should
		 * + read and process incoming methods while sending output frames. To cancel a
		 * + partially-send content, the server sends a content body frame of size 1 (i.e.
		 * + with no data except the frame-end octet).
		 * @rule
		 * + @name 2
		 * + @doc
		 * + The server SHOULD interpret this method as meaning that the client is unable to
		 * + process the message at this time.
		 * + @scenario
		 * + TODO.
		 * @rule
		 * + @name 3
		 * + @doc
		 * + The client MUST NOT use this method as a means of selecting messages to process.
		 * + @scenario
		 * + TODO.
		 * @rule
		 * + @name 4
		 * + @doc
		 * + A client publishing messages to a channel in confirm mode SHOULD be capable of accepting
		 * + and somehow handling the Nack method.
		 * + @scenario
		 * + TODO
		 */
		nack: {
			index: 120,
			field: {
				delivery_tag: {
					domain: "delivery-tag"
				},
				multiple: {
					domain: "bit"
				},
				requeue: {
					domain: "bit"
				}
			}
		}
	}
};

