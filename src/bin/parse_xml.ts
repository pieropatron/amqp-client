import * as path from 'path';
import * as axios from 'axios';
import * as fs from 'fs';
import {pipeline} from 'stream/promises';
import * as lib from './parse_xml_lib/FileBuffer';
import {ReadXml, XmlElement, Comment} from './parse_xml_lib/ReadXml';

const debug = process.argv[2] === '--debug';

const FOLDER = path.join(__dirname + path.sep, '../proto' + path.sep);
// const FOLDER = debug ? path.join(__dirname + path.sep, '../proto' + path.sep) :  path.join(__dirname + path.sep, `proto-${(new Date().toISOString().replace(/[-|:| |.|Z]/g, ""))}` + path.sep);

if (!fs.existsSync(FOLDER)){
	fs.mkdirSync(FOLDER);
}

const FileBuffers = new lib.FileBuffers(FOLDER);

const XML_URL = "https://www.rabbitmq.com/resources/specs/amqp0-9-1.extended.xml";
const XML_LOCAL = __dirname + '/amqp0-9-1.extended.xml';
const get_xml = async ()=>{
	if (debug) return;
	const response = await axios.default.get(XML_URL, {
		responseType: 'stream'
	});
	await pipeline(
		response.data,
		fs.createWriteStream(XML_LOCAL)
	);
};

const run = async ()=>{
	await get_xml();

	const xml = await ReadXml(XML_LOCAL);
	['licence', 'readme', 'warning'].forEach(filename=>{
		const file = FileBuffers.textFile(filename.toUpperCase());
		file.push(`NB: Information below containing part of xml from ${XML_URL},\nauthor of project has no relation to content.\n\n` + xml[filename].join("\n"));
	});

	const constant = FileBuffers.script("constant");

	const export_version = ()=>{
		const attributes = xml.amqp.attributes;

		constant
			.push(`export const VERSION = Object.freeze({`)
			.push(`major: ${attributes.major},`, 1)
			.push(`minor: ${attributes.minor},`, 1)
			.push(`revision: ${attributes.revision}`, 1)
			.push(`});`)
			.push()
			;

		constant
			.push(`export const PORT=${attributes.port};`)
			.push()
			;
	};

	export_version();

	const export_constant = ()=>{
		const elements: XmlElement[] = xml.amqp.constant;
		const first_comment = elements[0].comments.shift() as Comment;
		constant.pushComments({ key: '', comments: [first_comment] } as XmlElement);

		const groups = {
			frame_types: [] as XmlElement[],
			frame_const: [] as XmlElement[],
			reply_success: [] as XmlElement[],
			soft_error : [] as XmlElement[],
			hard_error : [] as XmlElement[]
		};

		const group_keys = Object.keys(groups);
		let group_idx = -1;
		for (const element of elements){
			if (element.comments.length){
				group_idx++;
			}
			const key = element.attributes.class ? element.attributes.class.replace("-", "_") : group_keys[group_idx];
			groups[key].push(element);
		}

		for (let i=0; i<2; i++){
			const key = group_keys[i];
			const elements = groups[key] as XmlElement[];
			const comments = elements[0].comments;
			elements[0].comments = [];
			constant
				.pushComments({key: "", comments} as any)
				.push(`export const ${key.toUpperCase()} = Object.freeze({`)
				;
			elements.forEach(element=>{
				constant.pushKeyValue(element.attributes.name, element.attributes.value, 1);
			});
			constant.endObject(0, ");");
			constant.push();
		}

		const ar_reply_codes: number[] = [];

		const push_succes = ()=>{
			const element = groups.reply_success[0];

			constant
				.pushComments({ key: "", comments: [element.comments[0]]} as any)
				.push(`export const REPLY_CODES = Object.freeze({`)
				.pushComments({ key: "", comments: [element.comments[1]] } as any, 1)
				.pushKeyValue(element.attributes.name.toUpperCase(), element.attributes.value, 1)
				;

			ar_reply_codes.push(element.attributes.value);
		};

		push_succes();

		for (let i = 3; i < 5; i++) {
			let key = group_keys[i];
			const elements = groups[key] as XmlElement[];

			key = `reply_${key}`;
			const const_name = key.toUpperCase();
			constant.push(`${const_name}: Object.freeze({`, 1);

			elements.forEach(element => {
				constant.pushComments(element, 2);
				const value = element.attributes.value;
				const name = lib.getVarName(element.attributes.name);
				constant.push(`${name}: ${value},`, 2);
				ar_reply_codes.push(value);
			});
			constant.endObject(1, "),");
		}
		constant.push(`get REPLY_CODES_ALL(){ return new Set([${ar_reply_codes.join(", ")}]);}`, 1);
		constant.endObject(0, ");");
		constant.push();
	};

	export_constant();

	const DOMAINS = new Map<string, {type: string, tstype: string, assert: {check: string, value?: string}[]}>();

	const export_domain = ()=>{
		const script = FileBuffers.script("domain");

		const elements: XmlElement[] = xml.amqp.domain;
		const first_comment = elements[0].comments.shift() as Comment;
		script
			.pushComments({ key: '', comments: [first_comment] } as XmlElement)
			;

		elements.forEach(element => {
			const {name, type} = element.attributes as {name: string, type: string};
			let tstype: string;
			if (type === 'bit'){
				tstype = 'boolean';
			} else if (type === 'short' || type === 'long' || type === 'octet'){
				tstype = 'number';
			} else if (type === 'shortstr' || type === 'longstr'){
				tstype = 'string';
			} else if (type === 'longlong'){
				tstype = 'bigint';
			} else if (type === 'table'){
				tstype = 'object';
			} else if (type === 'timestamp'){
				tstype = 'Date';
			} else {
				throw new Error(`Unknown domain type ${type}`);
			}

			DOMAINS.set(name, {type, tstype, assert: element.assert.map(element=>element.attributes)});
		});

		script.push().push(`export const DOMAIN = {`);
		script.pushElementsAsProperties("name", elements, 1, false);
		script.endObject(0, ";");
	};
	export_domain();

	const TYPE_TO_BUFFER_RW = {
		short: "uint16",
		shortstr: "shortstr",
		longlong: "uint64",
		table: "table",
		long: "uint32",
		octet: "uint8",
		longstr: "longstr",
		timestamp: "timestamp"
	};

	const TYPE_INITIAL_SZ = {
		short: { static: 2, dynamic: ''} ,
		shortstr: { static: 1, dynamic: 'string' },
		longlong: { static: 8, dynamic: '' },
		table: { static: 4, dynamic: 'table'},
		long: { static: 4, dynamic: '' },
		octet: { static: 1, dynamic: '' },
		longstr: { static: 4, dynamic: 'string' },
		timestamp: { static: 8, dynamic: '' }
	};

	const MAP_CODEC = new Map<number, lib.CodecItem>();
	const api_types = new lib.ScriptBuffer('api_types');

	const api = FileBuffers.script('api');

	xml.amqp.class.forEach(class_el => {
		const script_name = class_el.attributes.name as string;
		const script = FileBuffers.script(script_name);

		script.pushComments(class_el);
		class_el.comments = [];

		const class_index = class_el.attributes.index;

		if (class_el.field.length){
			if (script_name !== 'basic') {
				throw new Error(`Unknown properties for ${script_name}`);
			}

			const method_name = lib.getVarName(script_name + "_properties");
			const method_type = method_name.toUpperCase();
			const codec = new lib.CodecItem(method_name, method_type);
			MAP_CODEC.set(class_index, codec);
			api_types.push(`export type ${method_type} = Partial<{`);
			if (class_el.field.length > 16 || class_el.field.length < 9){
				throw new Error(`Unexpected properies size`);
			}

			codec.decode
				.push(`const value = {} as ${method_type};`, 1)
				.push(`const flag = reader.uint16(path + ".flag");`, 1)
				.push(`if (!flag) return value;`, 1)
				;

			codec.encode
				.push(`const flag_offset = writer.offset;`, 1)
				.push(`writer.uint16(path + ".flag", 0);`, 1)
				.push(`if (!Object.keys(value).length) return;`, 1)
				.push('let flag = 0;', 1)
				;

			class_el.field.forEach((field_el, i)=>{
				api_types.pushComments(field_el, 1);
				const field_name = lib.getVarName(field_el.attributes.name);
				if (field_name === 'reserved'){
					return;
				}
				codec.count_not_reserved++;
				const domain_name = field_el.attributes.domain || field_el.attributes.type;
				const domain = DOMAINS.get(domain_name);
				if (domain === undefined) {
					throw new Error(`Unknown domain/type ${domain_name} for ${field_name}`);
				}

				api_types.push(`${field_name}: ${domain.tstype},`, 1);

				const mask = 1 << (16 - i - 1);
				if (domain.type === 'bit'){
					codec.decode.push(`value.${field_name} = !!(flag & ${mask});`, 1);
					codec.encode
						.push(`if ("${field_name}" in value){`, 1)
						.push(`flag = flag | ${mask};`, 2)
						.push(`}`, 1)
						;
				} else {
					codec.initial_size_list.push({ key: field_name, ...TYPE_INITIAL_SZ[domain.type] });
					const buffer_method = TYPE_TO_BUFFER_RW[domain.type];
					codec.decode.push(`if (flag & ${mask}) value.${field_name} = reader.${buffer_method}(path + ".${field_name}");`, 1);
					codec.encode
						.push(`if ("${field_name}" in value){`, 1)
						.push(`flag = flag | ${mask};`, 2)
						.push(`writer.${buffer_method}(path + ".${field_name}", value.${field_name} as ${domain.tstype});`, 2)
						.push(`}`, 1)
						;
				}
			});
			codec.encode.push(`writer.buffer.writeUInt16BE(flag, flag_offset);`, 1);
			api_types.push('}>;');
			codec.finish();
		}

		class_el.method.forEach(method_el=>{
			const id = (class_index << 16) | method_el.attributes.index;
			const method_name = lib.getVarName(script_name + "_" + method_el.attributes.name);
			if (method_el.field.length){
				const method_type = method_name.toUpperCase();
				const codec = new lib.CodecItem(method_name, method_type);
				MAP_CODEC.set(id, codec);
				codec.decode.push(`const value = {} as ${method_type};`, 1);

				const api_types_start = api_types.lines.length;
				api_types.push(`export type ${method_type} = {`);
				let bits: {field_name: string, reserved: boolean}[] = [];

				const flush_bits = ()=>{
					if (!bits.length){
						return;
					}
					if (bits.length > 8){
						throw new Error(`Unexpected bits size!`);
					}

					if (bits.length === 1){
						const {field_name, reserved} = bits[0];
						if (reserved){
							codec.decode.push(`reader.skip(1);`, 1);
							codec.encode.push(`writer.skip(1);`, 1);
						} else {
							codec.count_not_reserved++;
							codec.decode.push(`value.${field_name} = reader.boolean(\`\${path}.${field_name}\`);`, 1);
							codec.encode.push(`writer.boolean(\`\${path}.${field_name}\`, value.${field_name});`, 1);
						}
					} else {
						codec.decode.push(`const flag = reader.uint8(path + ".flag");`, 1);
						codec.encode.push(`let flag = 0;`, 1);
						bits.forEach(({field_name, reserved}, idx)=>{
							const mask = 1 << idx;
							if (!reserved){
								codec.count_not_reserved++;
								codec.decode.push(`value.${field_name} = !!(flag & ${mask});`, 1);
								codec.encode.push(`if (value.${field_name}) flag = flag | ${mask};`, 1);
							}
						});
						codec.encode.push(`writer.uint8(path + ".flag", flag);`, 1);
					}
					codec.initial_size_list.push({ key: 'flag', dynamic: '', static: 1 });
					bits = [];
				};

				method_el.field.forEach((field_el, i)=>{
					const field_name = lib.getVarName(field_el.attributes.name);
					if (field_name === 'class_id'){
						method_el.field[i+1].comments.unshift(...field_el.comments);
						return;
					}

					const domain_name = field_name === 'method_id' ? 'long' : (field_el.attributes.domain || field_el.attributes.type);
					const domain = DOMAINS.get(domain_name);
					if (domain === undefined){
						throw new Error(`Unknown domain/type ${domain_name} for ${field_name}`);
					}

					const reserved = !!field_el.attributes.reserved;
					if (!reserved){
						codec.count_not_reserved++;
						api_types.pushComments(field_el, 1);
						api_types.push(`${field_name}: ${domain.tstype},`, 1);
						field_el.comments = [];
					}

					if (domain.type === 'bit'){
						bits.push({field_name, reserved});
					} else {
						flush_bits();
						const var_name = `value.${field_name}`;
						const buffer_method = TYPE_TO_BUFFER_RW[domain.type];
						if (reserved){
							const initial_size = TYPE_INITIAL_SZ[domain.type];
							codec.initial_size_list.push({ key: field_name, ...initial_size, dynamic: "" });
							codec.decode.push(`reader.skip(${initial_size.static});`, 1);
							codec.encode.push(`writer.skip(${initial_size.static});`, 1);
						} else {
							codec.initial_size_list.push({ key: field_name, ...TYPE_INITIAL_SZ[domain.type] });
							codec.decode.push(`${var_name} = reader.${buffer_method}(\`\${path}.${field_name}\`);`, 1);
							const asserts: { check: string, value: string }[] = [...field_el.assert.map(el => el.attributes), ...domain.assert];
							if (asserts.length) {
								const set_used = new Set<string>();
								asserts.forEach(({ check }) => {
									if (set_used.has(check)) {
										return;
									}
									set_used.add(check);
									if (check === 'le') {
										return;
									}
									codec.pushBoth(`ASSERTS.${check}(\`\${path}.${field_name}\`, ${var_name});`, 1);
								});
							}
							codec.encode.push(`writer.${buffer_method}(\`\${path}.${field_name}\`, ${var_name});`, 1);
						}
					}
				});
				if (codec.count_not_reserved){
					api_types.endObject(0, `;`);
				} else {
					api_types.lines.splice(api_types_start);
				}
				flush_bits();
				codec.finish();
			} else {
				const codec = new lib.CodecItem(method_name, "void");
				codec.finish();
				MAP_CODEC.set(id, codec);
			}
		});

		script.push().push(`export const ${script_name.toUpperCase()} = {`);
		script.pushAttributes(class_el.attributes, 1);
		script.pushChildren(class_el, 1);
		script.endObject(0, ";");
	});

	api
		.push(`import { Socket } from "net";`)
		.push("import { BufferReader, BufferWriter, ASSERTS, ENCODING, writeSocket, writeVoid, EMPTY_FRAME_SIZE } from './codec';")
		.push("import { FRAME_CONST } from './constant';")
		.push()
		.concat(api_types)
		.push(`export const DECODERS = new Map<number, (reader: BufferReader, path: string)=>any>([`)
		;

	MAP_CODEC.forEach((codec, id)=>{
		if (codec.count_not_reserved || codec.tstype === 'void'){
			api.push(`/** ${codec.name} */`, 1);
		} else {
			api.push(`/** ${codec.name}, reserved only */`, 1);
		}
		if (codec.tstype === 'void'){
			api.push(`[${id}, ()=>null],`, 1);
		} else {
			if (codec.count_not_reserved){
				api.push(`[${id}, (reader, path)=>{`, 1);
			} else {
				api.push(`[${id}, (reader)=>{`, 1);
			}
			api.concat(codec.decode, 1);
			api.push("}],", 1);
		}
	});

	api.removeLastSep().push("]);");

	api.push(`export const API = {`);

	MAP_CODEC.forEach((codec, id) => {
		if (codec.name === 'basic_properties') {
			api
				.push(`publish_header: async (socket: Socket, channel: number, value: ${codec.tstype}, body_size: number)=>{`, 1)
				.push(`const writer = new BufferWriter(FRAME_CONST.frame_min_size, true);`, 2)
				.push(`writer.headerstart(channel, ${id}, body_size);`, 2)
				.push(`const path = "properties";`, 2)
				.concat(codec.encode, 1)
				.push(`writer.frameend();`, 2)
				.push(`writer.setframelength();`, 2)
				.push()
				.push(`await writeSocket(socket, writer);`, 2)
				.push("},", 1)
				;
			return;
		}

		const is_void = codec.tstype === 'void';
		const is_connection = codec.name.startsWith('connection');

		if (is_void){
			if (is_connection){
				api.push(`${codec.name}: (socket: Socket)=>{ return writeVoid(${id}, socket, 0); },`, 1);
			} else {
				api.push(`${codec.name}: (socket: Socket, channel: number)=>{ return writeVoid(${id}, socket, channel); },`, 1);
			}
			return;
		}
		const is_empty_value = (codec.count_not_reserved === 0);
		if (is_connection){
			if (is_empty_value){
				api.push(`${codec.name}: async (socket: Socket)=>{`, 1);
			} else {
				api.push(`${codec.name}: async (socket: Socket, value: ${codec.tstype})=>{`, 1);
			}
		} else {
			if (is_empty_value){
				api.push(`${codec.name}: async (socket: Socket, channel: number)=>{`, 1);
			} else {
				api.push(`${codec.name}: async (socket: Socket, channel: number, value: ${codec.tstype})=>{`, 1);
			}
		}

		const {has_table, value: initial_size_string} = codec.compile_initial_size(4);
		if (has_table){
			api.push(`const writer = new BufferWriter(${initial_size_string}, true);`, 2);
			if (is_connection){
				api.push(`writer.methodstart(0, 0, ${id});`, 2);
			} else {
				api.push(`writer.methodstart(channel, 0, ${id});`, 2);
			}
		} else {
			api.push(`const frame_size = ${initial_size_string};`, 2);
			api.push(`const writer = new BufferWriter(frame_size, false);`, 2);
			if (is_connection){
				api.push(`writer.methodstart(0, frame_size - EMPTY_FRAME_SIZE, ${id});`, 2);
			} else {
				api.push(`writer.methodstart(channel, frame_size - EMPTY_FRAME_SIZE, ${id});`, 2);
			}
		}

		if (codec.count_not_reserved){
			api.push(`const path = "arguments";`, 2);
		}
		api
			.concat(codec.encode, 1)
			.push(`writer.frameend();`, 2)
			;
		if (has_table){
			api.push(`writer.setframelength();`, 2);
		}
		api.push(`return writeSocket(socket, writer);`, 2);
		api.endObject(1);
	});
	api
		.endObject(0, ";")
		.push()
		;

	api.push(`export const METHODS = Object.freeze({`);
	MAP_CODEC.forEach((codec, id)=>{
		api.push(`${codec.name}: ${id},`, 1);
	});
	api.endObject(0, ");");

	api
		.push()
		.push(`export const METHODS_NAMES = Object.freeze({`)
		;
	MAP_CODEC.forEach((codec, id)=>{
		api.push(`${id}: "${codec.name}",`, 1);
	});
	api.endObject(0, ");");

	await FileBuffers.save();
};

run().then(()=>{
	console.log("OK");
	process.exit(0);
}, error=>{
	console.error(error);
	process.exit(1);
});
