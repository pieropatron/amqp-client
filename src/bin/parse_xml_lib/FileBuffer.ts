import * as path from 'path';
import * as fsp from 'fs/promises';
import { XmlElement } from './ReadXml';

export const getVarName = (name: string)=>{
	return name.replace(/-/g, "_");
};

export const getConstName = (name: string)=>{
	return getVarName(name).toUpperCase();
};

export class FileBuffer {
	filepath: string;
	lines: string[] = [];
	constructor(filename: string) {
		this.filepath = filename;
	}

	push(line = "", tabs = 0) {
		const prefix = tabs ? "".padStart(tabs, '\t') : "";
		this.lines.push(prefix + line);
		return this;
	}

	async save() {
		const lines = this.lines;
		if (lines.length && !(lines[lines.length - 1]).endsWith('\n')) {
			lines.push("\n");
		}

		await fsp.writeFile(this.filepath, lines.join("\n"));
	}
}

const sys_attrs = new Set<string>([
	"codec"
]);

export class ScriptBuffer extends FileBuffer {
	private get lastIdx(){
		return this.lines.length - 1;
	}

	get last(){
		return this.lines[this.lastIdx];
	}

	set last(value: string){
		this.lines[this.lastIdx] = value;
	}

	pushComments(element: XmlElement, tabs = 0){
		const comments = element.comments;
		if (element.chassis && element.chassis.length){
			const line = element.chassis.map(element => {
				return `${element.attributes.name}: ${element.attributes.implement}`;
			}).join(", ");
			comments.push({ type: 'chassis', lines: [line] });
			element.chassis = [];
		}
		if (element.rule){
			element.rule.forEach(element=>{
				const { name, "on-failure": on_failure} = element.attributes;
				if (!name){
					throw new Error(`rule name missed!`);
				}

				const lines: string[] = [];

				lines.push(`+ @name ${name}`);

				element.comments.forEach(comment=>{
					if (comment.type){
						lines.push(`+ @${comment.type}`);
					}
					lines.push(...comment.lines.map(line=>`+ ${line}`));
				});
				if (on_failure) {
					lines.push(`+ @on-failure`);
					lines.push(`+ ${on_failure}`);
				}

				comments.push({type: 'rule', lines});

				// const rule = `rule_${getVarName(name.toString())}`;
				// element.comments.forEach(comment=>{
				// 	comment.type = `${rule}_` + getVarName(comment.type);
				// 	comments.push(comment);
				// });
				// if (on_failure) {
				// 	comments.push({
				// 		type: `${rule}_on_failure`,
				// 		lines: [on_failure]
				// 	});
				// }
			});
			element.rule = [];
		}
		if (comments.length){
			this.push("/**", tabs);
			for (const comment of comments){
				if (comment.type){
					this.push(` * @${comment.type}`, tabs);
				}
				for (const line of comment.lines){
					this.push(` * ${line}`, tabs);
				}
			}
			this.push(" */", tabs);
		}
		return this;
	}

	pushKeyValue(key: string, value: any, tabs = 0){
		const keyChecked = getVarName(key);
		const type = typeof(value);
		if (type === 'object'){
			if (Array.isArray(value)){
				throw new Error(`Invalid use`);
			}
			this.startObject(key, tabs);
			for (const key in value){
				this.pushKeyValue(key, value[key], tabs+1);
			}
			this.endObject(tabs);
		} else {
			if (type === 'string' && !sys_attrs.has(key)) value = `"${value}"`;
			this.push(`${keyChecked}: ${value},`, tabs);
		}
		return this;
	}

	removeLastSep(){
		this.last = this.last.replace(/,$/, "");
		return this;
	}

	startArray(key="", tabs = 0){
		const line = key ? `${key}: [` : "[";
		return this.push(line, tabs);
	}

	endArray(tabs=0){
		return this.removeLastSep().push("],", tabs);
	}

	startObject(key="", tabs = 0){
		const line = key ? `${key}: {` : "{";
		return this.push(line, tabs);
	}

	endObject(tabs=0, suff = ","){
		return this.removeLastSep().push(`}${suff}`, tabs);
	}

	pushAttributes(attrs: any, tabs = 0){
		for (const key in attrs){
			this.pushKeyValue(key, attrs[key], tabs);
		}
		return this;
	}

	pushChildren(element: XmlElement, tabs = 0){
		["field", "method"].forEach(key=>{
			const elements: XmlElement[] = element[key];
			if (elements.length) {
				this.startObject(key, tabs);
				this.pushElementsAsProperties("name", elements, tabs + 1, false);
				this.endObject(tabs);
			}
		});
		["rule", "assert", "chassis", "response"].forEach(key=>{
			const elements: XmlElement[] = element[key];
			if (elements.length){
				this.startArray(key, tabs);
				this.pushElementsAsProperties("", elements, tabs+1, false);
				this.endArray(tabs);
			}
		});

		return this;
	}

	pushElementsAsProperties(AttributeKey: string, elements: XmlElement[], tabs = 0, end = true){
		for (const element of elements){
			this.pushComments(element, tabs);
			const attrs = element.attributes;
			const key = AttributeKey ? getVarName(attrs[AttributeKey]): "";
			if (AttributeKey){
				delete attrs[AttributeKey];
			}
			this
				.startObject(key, tabs)
				.pushAttributes(attrs, tabs + 1)
				.pushChildren(element, tabs + 1)
				.endObject(tabs)
				;
		}
		if (end){
			this.endObject(tabs - 1);
		}
	}

	concat(script: ScriptBuffer, tabs = 0){
		script.lines.forEach(line=>{
			this.push(line, tabs);
		});
		return this;
	}
}

export class CodecItem {
	decode = new ScriptBuffer('decode');
	encode = new ScriptBuffer('encode');
	name: string;
	tstype: string;
	initial_size_list: {key: string, static: number, dynamic: string}[] = [];
	count_not_reserved = 0;

	constructor(name: string, tstype: string){
		this.name = name;
		this.tstype = tstype;
		this.initial_size_list.push({key: 'frame_size', static: 8, dynamic: ''});
	}

	pushBoth(line: string, tabs?: number){
		this.decode.push(line, tabs);
		this.encode.push(line, tabs);
		return this;
	}

	finish(){
		if (this.tstype === 'void') return;
		if (this.count_not_reserved){
			this.decode.push("return value;", 1);
		} else {
			this.decode.lines.shift();
			this.decode.push("return null;", 1);
		}
	}

	compile_initial_size(static_size: number){
		const var_size: string[] = [];
		let has_table = false;
		this.initial_size_list.forEach(item => {
			static_size += item.static;
			if (item.dynamic === 'string') {
				var_size.push(`Buffer.byteLength(value.${item.key}, ENCODING)`);
			} else if (item.dynamic === 'table') {
				has_table = true;
				var_size.push(`(Object.keys(value.${item.key}).length ? FRAME_CONST.frame_min_size : 0)`);
			}
		});
		if (static_size) var_size.unshift(static_size.toString());

		return {value: var_size.join(" + "), has_table};
	}
}


export class FileBuffers {
	public folder: string;
	private files: FileBuffer[] = [];
	constructor(folder: string){
		this.folder = folder;
	}

	textFile(filename: string){
		const file = new FileBuffer(path.join(this.folder, filename));
		this.files.push(file);
		return file;
	}

	script(filename: string){
		const file = new ScriptBuffer(path.join(this.folder, filename + '.ts'));
		this.files.push(file);
		return file;
	}

	async save(){
		await Promise.all(this.files.map(file=>{
			return file.save();
		}));
	}
}
