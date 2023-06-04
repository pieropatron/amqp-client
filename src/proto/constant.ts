export const VERSION = Object.freeze({
	major: 0,
	minor: 9,
	revision: 1
});

export const PORT=5672;

/**
 * @comment
 * 
 * ======================================================
 * ==       CONSTANTS
 * ======================================================
 * 
 */
/**
 * @comment
 * Frame types
 */
export const FRAME_TYPES = Object.freeze({
	frame_method: 1,
	frame_header: 2,
	frame_body: 3,
	frame_heartbeat: 8
});

/**
 * @comment
 * Protocol constants
 */
export const FRAME_CONST = Object.freeze({
	frame_min_size: 4096,
	frame_end: 206
});

/**
 * @comment
 * Reply codes
 */
export const REPLY_CODES = Object.freeze({
	/**
	 * @doc
	 * Indicates that the method completed successfully. This reply code is
	 * reserved for future use - the current protocol design does not use positive
	 * confirmation and reply codes are sent only in case of an error.
	 */
	REPLY_SUCCESS: 200,
	REPLY_SOFT_ERROR: Object.freeze({
		/**
		 * @doc
		 * The client attempted to transfer content larger than the server could accept
		 * at the present time. The client may retry at a later time.
		 */
		content_too_large: 311,
		/**
		 * @doc
		 * Returned when RabbitMQ sends back with 'basic.return' when a
		 * 'mandatory' message cannot be delivered to any queue.
		 */
		no_route: 312,
		/**
		 * @doc
		 * When the exchange cannot deliver to a consumer when the immediate flag is
		 * set. As a result of pending data on the queue or the absence of any
		 * consumers of the queue.
		 */
		no_consumers: 313,
		/**
		 * @doc
		 * The client attempted to work with a server entity to which it has no
		 * access due to security settings.
		 */
		access_refused: 403,
		/**
		 * @doc
		 * The client attempted to work with a server entity that does not exist.
		 */
		not_found: 404,
		/**
		 * @doc
		 * The client attempted to work with a server entity to which it has no
		 * access because another client is working with it.
		 */
		resource_locked: 405,
		/**
		 * @doc
		 * The client requested a method that was not allowed because some precondition
		 * failed.
		 */
		precondition_failed: 406
	}),
	REPLY_HARD_ERROR: Object.freeze({
		/**
		 * @doc
		 * An operator intervened to close the connection for some reason. The client
		 * may retry at some later date.
		 */
		connection_forced: 320,
		/**
		 * @doc
		 * The client tried to work with an unknown virtual host.
		 */
		invalid_path: 402,
		/**
		 * @doc
		 * The sender sent a malformed frame that the recipient could not decode.
		 * This strongly implies a programming error in the sending peer.
		 */
		frame_error: 501,
		/**
		 * @doc
		 * The sender sent a frame that contained illegal values for one or more
		 * fields. This strongly implies a programming error in the sending peer.
		 */
		syntax_error: 502,
		/**
		 * @doc
		 * The client sent an invalid sequence of frames, attempting to perform an
		 * operation that was considered invalid by the server. This usually implies
		 * a programming error in the client.
		 */
		command_invalid: 503,
		/**
		 * @doc
		 * The client attempted to work with a channel that had not been correctly
		 * opened. This most likely indicates a fault in the client layer.
		 */
		channel_error: 504,
		/**
		 * @doc
		 * The peer sent a frame that was not expected, usually in the context of
		 * a content header and body.  This strongly indicates a fault in the peer's
		 * content processing.
		 */
		unexpected_frame: 505,
		/**
		 * @doc
		 * The server could not complete the method because it lacked sufficient
		 * resources. This may be due to the client creating too many of some type
		 * of entity.
		 */
		resource_error: 506,
		/**
		 * @doc
		 * The client tried to work with some entity in a manner that is prohibited
		 * by the server, due to security settings or by some other criteria.
		 */
		not_allowed: 530,
		/**
		 * @doc
		 * The client tried to use functionality that is not implemented in the
		 * server.
		 */
		not_implemented: 540,
		/**
		 * @doc
		 * The server could not complete the method because of an internal error.
		 * The server may require intervention by an operator in order to resume
		 * normal operations.
		 */
		internal_error: 541
	}),
	get REPLY_CODES_ALL(){ return new Set([200, 311, 312, 313, 403, 404, 405, 406, 320, 402, 501, 502, 503, 504, 505, 506, 530, 540, 541]);}
});


