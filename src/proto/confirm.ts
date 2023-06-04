/**
 * @comment
 * ==  CONFIRM  ==========================================================
 * @doc
 * The Confirm class allows publishers to put the channel in
 * confirm mode and subsequently be notified when messages have been
 * handled by the broker.  The intention is that all messages
 * published on a channel in confirm mode will be acknowledged at
 * some point.  By acknowledging a message the broker assumes
 * responsibility for it and indicates that it has done something
 * it deems reasonable with it.
 * 
 * Unroutable mandatory or immediate messages are acknowledged
 * right after the Basic.Return method. Messages are acknowledged
 * when all queues to which the message has been routed
 * have either delivered the message and received an
 * acknowledgement (if required), or enqueued the message (and
 * persisted it if required).
 * 
 * Published messages are assigned ascending sequence numbers,
 * starting at 1 with the first Confirm.Select method. The server
 * confirms messages by sending Basic.Ack methods referring to these
 * sequence numbers.
 * @grammar
 * confirm            = C:SELECT S:SELECT-OK
 * @label
 * work with confirms
 * @chassis
 * server: SHOULD, client: MAY
 * @rule
 * + @name all messages acknowledged
 * + @doc
 * + The server MUST acknowledge all messages received after the
 * + channel was put into confirm mode.
 * @rule
 * + @name all queues
 * + @doc
 * + The server MUST acknowledge a message only after it was
 * + properly handled by all the queues it was delivered to.
 * @rule
 * + @name unroutable messages
 * + @doc
 * + The server MUST acknowledge an unroutable mandatory or
 * + immediate message only after it sends the Basic.Return.
 * @rule
 * + @name time guarantees
 * + @doc
 * + No guarantees are made as to how soon a message is
 * + acknowledged.  Applications SHOULD NOT make assumptions about
 * + this.
 */

export const CONFIRM = {
	name: "confirm",
	handler: "channel",
	index: 85,
	method: {
		/**
		 * @comment
		 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
		 * @text
		 * select confirm mode (i.e. enable publisher acknowledgements)
		 * @doc
		 * This method sets the channel to use publisher acknowledgements.
		 * The client can only use this method on a non-transactional
		 * channel.
		 * @chassis
		 * server: MUST
		 */
		select: {
			synchronous: 1,
			index: 10,
			field: {
				nowait: {
					domain: "no-wait"
				}
			},
			response: [
				{
					name: "select-ok"
				}
			]
		},
		/**
		 * @text
		 * acknowledge confirm mode
		 * @doc
		 * This method confirms to the client that the channel was successfully
		 * set to use publisher acknowledgements.
		 * @chassis
		 * client: MUST
		 */
		select_ok: {
			synchronous: 1,
			index: 11
		}
	}
};

