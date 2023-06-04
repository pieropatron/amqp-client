/**
 * @comment
 * ==  CHANNEL  ==========================================================
 * @doc
 * The channel class provides methods for a client to establish a channel to a
 * server and for both peers to operate the channel thereafter.
 * @grammar
 * channel             = open-channel *use-channel close-channel
 * open-channel        = C:OPEN S:OPEN-OK
 * use-channel         = C:FLOW S:FLOW-OK
 * / S:FLOW C:FLOW-OK
 * / functional-class
 * close-channel       = C:CLOSE S:CLOSE-OK
 * / S:CLOSE C:CLOSE-OK
 * @label
 * work with channels
 * @chassis
 * server: MUST, client: MUST
 */

export const CHANNEL = {
	name: "channel",
	handler: "channel",
	index: 20,
	method: {
		/**
		 * @comment
		 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
		 * @doc
		 * This method opens a channel to the server.
		 * @label
		 * open a channel for use
		 * @chassis
		 * server: MUST
		 * @rule
		 * + @name state
		 * + @doc
		 * + The client MUST NOT use this method on an already-opened channel.
		 * + @scenario
		 * + Client opens a channel and then reopens the same channel.
		 * + @on-failure
		 * + channel-error
		 */
		open: {
			synchronous: 1,
			index: 10,
			field: {
				/**
				 * @comment
				 * Deprecated: "out-of-band", must be zero
				 */
				reserved_1: {
					type: "shortstr",
					reserved: 1
				}
			},
			response: [
				{
					name: "open-ok"
				}
			]
		},
		/**
		 * @doc
		 * This method signals to the client that the channel is ready for use.
		 * @label
		 * signal that the channel is ready
		 * @chassis
		 * client: MUST
		 */
		open_ok: {
			synchronous: 1,
			index: 11,
			field: {
				/**
				 * @comment
				 * Deprecated: "channel-id", must be zero
				 */
				reserved_1: {
					type: "longstr",
					reserved: 1
				}
			}
		},
		/**
		 * @comment
		 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
		 * @doc
		 * This method asks the peer to pause or restart the flow of content data sent by
		 * a consumer. This is a simple flow-control mechanism that a peer can use to avoid
		 * overflowing its queues or otherwise finding itself receiving more messages than
		 * it can process. Note that this method is not intended for window control. It does
		 * not affect contents returned by Basic.Get-Ok methods.
		 * @label
		 * enable/disable flow from peer
		 * @chassis
		 * server: MUST, client: MUST
		 * @rule
		 * + @name initial-state
		 * + @doc
		 * + When a new channel is opened, it is active (flow is active). Some applications
		 * + assume that channels are inactive until started. To emulate this behaviour a
		 * + client MAY open the channel, then pause it.
		 * @rule
		 * + @name bidirectional
		 * + @doc
		 * + When sending content frames, a peer SHOULD monitor the channel for incoming
		 * + methods and respond to a Channel.Flow as rapidly as possible.
		 * @rule
		 * + @name throttling
		 * + @doc
		 * + A peer MAY use the Channel.Flow method to throttle incoming content data for
		 * + internal reasons, for example, when exchanging data over a slower connection.
		 * @rule
		 * + @name expected-behaviour
		 * + @doc
		 * + The peer that requests a Channel.Flow method MAY disconnect and/or ban a peer
		 * + that does not respect the request.  This is to prevent badly-behaved clients
		 * + from overwhelming a server.
		 */
		flow: {
			synchronous: 1,
			index: 20,
			field: {
				active: {
					domain: "bit"
				}
			},
			response: [
				{
					name: "flow-ok"
				}
			]
		},
		/**
		 * @doc
		 * Confirms to the peer that a flow command was received and processed.
		 * @label
		 * confirm a flow method
		 * @chassis
		 * server: MUST, client: MUST
		 */
		flow_ok: {
			index: 21,
			field: {
				active: {
					domain: "bit"
				}
			}
		},
		/**
		 * @comment
		 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
		 * @doc
		 * This method indicates that the sender wants to close the channel. This may be due to
		 * internal conditions (e.g. a forced shut-down) or due to an error handling a specific
		 * method, i.e. an exception. When a close is due to an exception, the sender provides
		 * the class and method id of the method which caused the exception.
		 * @label
		 * request a channel close
		 * @chassis
		 * client: MUST, server: MUST
		 * @rule
		 * + @name stability
		 * + @doc
		 * + After sending this method, any received methods except Close and Close-OK MUST
		 * + be discarded.  The response to receiving a Close after sending Close must be to
		 * + send Close-Ok.
		 */
		close: {
			synchronous: 1,
			index: 40,
			field: {
				reply_code: {
					domain: "reply-code"
				},
				reply_text: {
					domain: "reply-text"
				},
				/**
				 * @doc
				 * When the close is provoked by a method exception, this is the class of the
				 * method.
				 * @label
				 * failing method class
				 */
				class_id: {
					domain: "class-id"
				},
				method_id: {
					domain: "method-id"
				}
			},
			response: [
				{
					name: "close-ok"
				}
			]
		},
		/**
		 * @doc
		 * This method confirms a Channel.Close method and tells the recipient that it is safe
		 * to release resources for the channel.
		 * @label
		 * confirm a channel close
		 * @chassis
		 * client: MUST, server: MUST
		 * @rule
		 * + @name reporting
		 * + @doc
		 * + A peer that detects a socket closure without having received a Channel.Close-Ok
		 * + handshake method SHOULD log the error.
		 */
		close_ok: {
			synchronous: 1,
			index: 41
		}
	}
};

