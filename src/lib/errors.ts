import { REPLY_CODES } from '../proto/constant';
import { METHODS_NAMES, METHODS, CHANNEL_CLOSE, CONNECTION_CLOSE } from '../proto/api';

type CLOSE_TYPE = CHANNEL_CLOSE | CONNECTION_CLOSE;

export class CloseErrorBase extends Error {
	method_name: string;
	method_id: number;
	reply_code: number;
	data?: any;
	constructor(method_id: number, reply_code: number, reply_text: string, data?: any){
		super(reply_text);
		Error.captureStackTrace(this, this.constructor);
		this.method_name = METHODS_NAMES[method_id] || "unknown";
		this.method_id = method_id;
		this.reply_code = reply_code;
		if (data){
			this.data = data;
		}
	}

	get reply_text(){ return this.message; }
}

type ReplyHard = keyof typeof REPLY_CODES.REPLY_HARD_ERROR;

export class HardError extends CloseErrorBase {
	constructor(method_id: number, reply: ReplyHard, reply_text: string, data?: any){
		super(method_id, REPLY_CODES.REPLY_HARD_ERROR[reply], reply_text, data);
	}
}

type ReplySoft = keyof typeof REPLY_CODES.REPLY_SOFT_ERROR;

export class SoftError extends CloseErrorBase {
	constructor(method_id: number, reply: ReplySoft, reply_text: string, data?: any){
		super(method_id, REPLY_CODES.REPLY_SOFT_ERROR[reply], reply_text, data);
	}
}

export const BASIC_PROPERTIES_METHOD = METHODS.basic_properties << 16;

export function ErrorToClose(error?: Error | null | undefined): CLOSE_TYPE {
	if (error){
		if (error instanceof CloseErrorBase){
			return {
				method_id: error.method_id,
				reply_code: error.reply_code,
				reply_text: error.reply_text
			};
		} else {
			return {
				method_id: 0,
				reply_code: REPLY_CODES.REPLY_HARD_ERROR.internal_error,
				reply_text: error.message
			};
		}
	} else {
		return {
			method_id: 0,
			reply_code: REPLY_CODES.REPLY_SUCCESS,
			reply_text: "buy!"
		};
	}
}
