// deno-lint-ignore-file no-explicit-any

// This file is a copied and adapted from the Vite project under the MIT license.
// Original file: https://github.com/vitejs/vite/blob/13ac37df8e135fe6b4990fac6f149a36a19e5409/packages/vite/src/node/ssr/ssrTransform.ts

import { HaydiPlugin } from "../types.ts";
import {
	acorn,
	estree,
	estreeWalker,
	extractNames,
	MagicString,
} from "../../deps.ts";

interface Locatable {
	start: number;
	end: number;
}

type Node = estree.Node & Locatable;
type Identifier = estree.Identifier;
type Property = estree.Property;
type VariableDeclaration = estree.VariableDeclaration;
type Pattern = estree.Pattern;
type FunctionNode = estree.Function;

interface Visitors {
	onIdentifier: (
		node: Identifier & {
			start: number;
			end: number;
		},
		parent: Node,
		parentStack: Node[],
	) => void;
	onImportMeta: (node: Node) => void;
	onDynamicImport: (node: Node) => void;
}

export const MODULE_EXPORTS_KEY = `__haydi_exports__`;
export const IMPORT_KEY = `__haydi_import__`;
export const DYNAMIC_IMPORT_KEY = `__haydi_dynamic_import__`;
export const EXPORT_ALL_KEY = `__haydi_exportAll__`;
export const IMPORT_META_KEY = `__haydi_import_meta__`;

/**
 * Transforms a module into an async function body so that it can be
 * evaled in the server context to support custom transdforms and hot
 * module reloading.
 */
export function createModuleToFunctionBodyTransform(): HaydiPlugin {
	return {
		name: "server-transform",

		command: "serve",
		// platform: "server",

		transform(ctx) {
			const { code } = ctx;
			const { Parser: parser } = acorn;

			const s = new MagicString(code);

			let ast: any;
			try {
				ast = parser.parse(code, {
					sourceType: "module",
					ecmaVersion: "latest",
					locations: true,
					allowHashBang: true,
				});
			} catch (err) {
				if (!err.loc || !err.loc.line) throw err;
				const line = err.loc.line;
				throw new Error(
					`Parse failure: ${err.message}\nContents of line ${line}: ${
						code.split("\n")[line - 1]
					}`,
				);
			}

			let uid = 0;
			const deps = new Set<string>();
			const dynamicDeps = new Set<string>();
			const idToImportMap = new Map<string, string>();
			const declaredConst = new Set<string>();

			function defineImport(node: Node, source: string) {
				deps.add(source);
				const importId = `__vite_ssr_import_${uid++}__`;
				s.appendRight(
					node.start,
					`const ${importId} = await ${IMPORT_KEY}(${
						JSON.stringify(
							source,
						)
					});\n`,
				);
				return importId;
			}

			function defineExport(position: number, name: string, local = name) {
				s.appendLeft(
					position,
					`\nObject.defineProperty(${MODULE_EXPORTS_KEY}, "${name}", ` +
						`{ enumerable: true, configurable: true, get(){ return ${local} }});`,
				);
			}

			// 1. check all import statements and record id -> importName map
			for (const node of ast.body as Node[]) {
				// import foo from 'foo' --> foo -> __import_foo__.default
				// import { baz } from 'foo' --> baz -> __import_foo__.baz
				// import * as ok from 'foo' --> ok -> __import_foo__
				if (node.type === "ImportDeclaration") {
					s.remove(node.start, node.end);
					const importId = defineImport(node, node.source.value as string);
					for (const spec of node.specifiers) {
						if (spec.type === "ImportSpecifier") {
							idToImportMap.set(
								spec.local.name,
								`${importId}.${spec.imported.name}`,
							);
						} else if (spec.type === "ImportDefaultSpecifier") {
							idToImportMap.set(spec.local.name, `${importId}.default`);
						} else {
							// namespace specifier
							idToImportMap.set(spec.local.name, importId);
						}
					}
				}
			}

			// 2. check all export statements and define exports
			for (const node of ast.body as Node[]) {
				// named exports
				if (node.type === "ExportNamedDeclaration") {
					if (node.declaration) {
						if (
							node.declaration.type === "FunctionDeclaration" ||
							node.declaration.type === "ClassDeclaration"
						) {
							// export function foo() {}
							defineExport(node.end, node.declaration.id!.name);
						} else {
							// export const foo = 1, bar = 2
							for (const declaration of node.declaration.declarations) {
								const names = extractNames(declaration.id as any);
								for (const name of names) {
									defineExport(node.end, name);
								}
							}
						}
						s.remove(node.start, (node.declaration as Node).start);
					} else {
						s.remove(node.start, node.end);
						if (node.source) {
							// export { foo, bar } from './foo'
							const importId = defineImport(node, node.source.value as string);
							for (const spec of node.specifiers) {
								defineExport(
									node.end,
									spec.exported.name,
									`${importId}.${spec.local.name}`,
								);
							}
						} else {
							// export { foo, bar }
							for (const spec of node.specifiers) {
								const local = spec.local.name;
								const binding = idToImportMap.get(local);
								defineExport(node.end, spec.exported.name, binding || local);
							}
						}
					}
				}

				// default export
				if (node.type === "ExportDefaultDeclaration") {
					const expressionTypes = ["FunctionExpression", "ClassExpression"];
					if (
						"id" in node.declaration &&
						node.declaration.id &&
						!expressionTypes.includes(node.declaration.type)
					) {
						// named hoistable/class exports
						// export default function foo() {}
						// export default class A {}
						const { name } = node.declaration.id;
						s.remove(
							node.start,
							node.start + 15, /* 'export default '.length */
						);
						s.append(
							`\nObject.defineProperty(${MODULE_EXPORTS_KEY}, "default", ` +
								`{ enumerable: true, configurable: true, value: ${name} });`,
						);
					} else {
						// anonymous default exports
						s.update(
							node.start,
							node.start + 14, /* 'export default'.length */
							`${MODULE_EXPORTS_KEY}.default =`,
						);
					}
				}

				// export * from './foo'
				if (node.type === "ExportAllDeclaration") {
					s.remove(node.start, node.end);
					const importId = defineImport(node, node.source.value as string);
					if (node.exported) {
						defineExport(node.end, node.exported.name, `${importId}`);
					} else {
						s.appendLeft(node.end, `${EXPORT_ALL_KEY}(${importId});`);
					}
				}
			}

			// 3. convert references to import bindings & import.meta references
			walk(ast, {
				onIdentifier(id, parent, parentStack) {
					const grandparent = parentStack[1];
					const binding = idToImportMap.get(id.name);
					if (!binding) {
						return;
					}
					if (isStaticProperty(parent) && parent.shorthand) {
						// let binding used in a property shorthand
						// { foo } -> { foo: __import_x__.foo }
						// skip for destructuring patterns
						if (
							!isNodeInPattern(parent) ||
							isInDestructuringAssignment(parent, parentStack)
						) {
							s.appendLeft(id.end, `: ${binding}`);
						}
					} else if (
						(parent.type === "PropertyDefinition" &&
							grandparent?.type === "ClassBody") ||
						(parent.type === "ClassDeclaration" && id === parent.superClass)
					) {
						if (!declaredConst.has(id.name)) {
							declaredConst.add(id.name);
							// locate the top-most node containing the class declaration
							const topNode = parentStack[parentStack.length - 2];
							s.prependRight(topNode.start, `const ${id.name} = ${binding};\n`);
						}
					} else {
						s.update(id.start, id.end, binding);
					}
				},
				onImportMeta(node) {
					s.update(node.start, node.end, IMPORT_META_KEY);
				},
				onDynamicImport(node) {
					s.update(node.start, node.start + 6, DYNAMIC_IMPORT_KEY);
					if (
						node.type === "ImportExpression" &&
						node.source.type === "Literal"
					) {
						dynamicDeps.add(node.source.value as string);
					}
				},
			});

			const map = s.generateMap({ hires: true });
			map.sources = [ctx.url.pathname];
			map.sourcesContent = [ctx.code];

			return {
				code: s.toString(),
				map,
				type: "application/javascript",
				deps: [...deps],
				dynamicDeps: [...dynamicDeps],
			};
		},
	};
}

/**
 * Same logic from \@vue/compiler-core & \@vue/compiler-sfc
 * Except this is using acorn AST
 */
function walk(
	root: Node,
	{ onIdentifier, onImportMeta, onDynamicImport }: Visitors,
) {
	const parentStack: Node[] = [];
	const varKindStack: VariableDeclaration["kind"][] = [];
	const scopeMap = new WeakMap<estree.Node, Set<string>>();
	const identifiers: [id: any, stack: Node[]][] = [];

	const setScope = (node: estree.Node, name: string) => {
		let scopeIds = scopeMap.get(node);
		if (scopeIds && scopeIds.has(name)) {
			return;
		}
		if (!scopeIds) {
			scopeIds = new Set();
			scopeMap.set(node, scopeIds);
		}
		scopeIds.add(name);
	};

	function isInScope(name: string, parents: Node[]) {
		return parents.some((node) => node && scopeMap.get(node)?.has(name));
	}
	function handlePattern(p: Pattern, parentScope: estree.Node) {
		if (p.type === "Identifier") {
			setScope(parentScope, p.name);
		} else if (p.type === "RestElement") {
			handlePattern(p.argument, parentScope);
		} else if (p.type === "ObjectPattern") {
			p.properties.forEach((property) => {
				if (property.type === "RestElement") {
					setScope(parentScope, (property.argument as Identifier).name);
				} else {
					handlePattern(property.value, parentScope);
				}
			});
		} else if (p.type === "ArrayPattern") {
			p.elements.forEach((element) => {
				if (element) {
					handlePattern(element, parentScope);
				}
			});
		} else if (p.type === "AssignmentPattern") {
			handlePattern(p.left, parentScope);
		} else {
			setScope(parentScope, (p as any).name);
		}
	}

	(estreeWalker.walk as any)(root, {
		enter(node: Node, parent: Node | null) {
			if (node.type === "ImportDeclaration") {
				return this.skip();
			}

			// track parent stack, skip for "else-if"/"else" branches as acorn nests
			// the ast within "if" nodes instead of flattening them
			if (
				parent &&
				!(parent.type === "IfStatement" && node === parent.alternate)
			) {
				parentStack.unshift(parent);
			}

			// track variable declaration kind stack used by VariableDeclarator
			if (node.type === "VariableDeclaration") {
				varKindStack.unshift(node.kind);
			}

			if (node.type === "MetaProperty" && node.meta.name === "import") {
				onImportMeta(node);
			} else if (node.type === "ImportExpression") {
				onDynamicImport(node);
			}

			if (node.type === "Identifier") {
				if (
					!isInScope(node.name, parentStack) &&
					isRefIdentifier(node, parent!, parentStack)
				) {
					// record the identifier, for DFS -> BFS
					identifiers.push([node, parentStack.slice(0)]);
				}
			} else if (isFunction(node)) {
				// If it is a function declaration, it could be shadowing an import
				// Add its name to the scope so it won't get replaced
				if (node.type === "FunctionDeclaration") {
					const parentScope = findParentScope(parentStack);
					if (parentScope) {
						setScope(parentScope, node.id!.name);
					}
				}
				// walk function expressions and add its arguments to known identifiers
				// so that we don't prefix them
				node.params.forEach((p) => {
					if (p.type === "ObjectPattern" || p.type === "ArrayPattern") {
						handlePattern(p, node);
						return;
					}
					(estreeWalker.walk as any)(
						p.type === "AssignmentPattern" ? p.left : p,
						{
							enter(child: Node, parent: Node) {
								// skip params default value of destructure
								if (
									parent?.type === "AssignmentPattern" &&
									parent?.right === child
								) {
									return this.skip();
								}
								if (child.type !== "Identifier") return;
								// do not record as scope variable if is a destructuring keyword
								if (isStaticPropertyKey(child, parent)) return;
								// do not record if this is a default value
								// assignment of a destructuring variable
								if (
									(parent?.type === "TemplateLiteral" &&
										parent?.expressions.includes(child)) ||
									(parent?.type === "CallExpression" &&
										parent?.callee === child)
								) {
									return;
								}
								setScope(node, child.name);
							},
						},
					);
				});
			} else if (node.type === "Property" && parent!.type === "ObjectPattern") {
				// mark property in destructuring pattern
				setIsNodeInPattern(node);
			} else if (node.type === "VariableDeclarator") {
				const parentFunction = findParentScope(
					parentStack,
					varKindStack[0] === "var",
				);
				if (parentFunction) {
					handlePattern(node.id, parentFunction);
				}
			}
		},

		leave(node: Node, parent: Node | null) {
			// untrack parent stack from above
			if (
				parent &&
				!(parent.type === "IfStatement" && node === parent.alternate)
			) {
				parentStack.shift();
			}

			if (node.type === "VariableDeclaration") {
				varKindStack.shift();
			}
		},
	});

	// emit the identifier events in BFS so the hoisted declarations
	// can be captured correctly
	identifiers.forEach(([node, stack]) => {
		if (!isInScope(node.name, stack)) onIdentifier(node, stack[0], stack);
	});
}

const isStaticProperty = (node: estree.Node): node is Property =>
	node && node.type === "Property" && !node.computed;

const isStaticPropertyKey = (node: estree.Node, parent: estree.Node) =>
	isStaticProperty(parent) && parent.key === node;

const isNodeInPatternWeakSet = new WeakSet<estree.Node>();
const setIsNodeInPattern = (node: Property) => isNodeInPatternWeakSet.add(node);
const isNodeInPattern = (node: estree.Node): node is Property =>
	isNodeInPatternWeakSet.has(node);

function isInDestructuringAssignment(
	parent: estree.Node,
	parentStack: estree.Node[],
): boolean {
	if (
		parent &&
		(parent.type === "Property" || parent.type === "ArrayPattern")
	) {
		return parentStack.some((i) => i.type === "AssignmentExpression");
	}
	return false;
}

function isRefIdentifier(
	id: Identifier,
	parent: estree.Node,
	parentStack: estree.Node[],
) {
	// declaration id
	if (
		parent.type === "CatchClause" ||
		((parent.type === "VariableDeclarator" ||
			parent.type === "ClassDeclaration") &&
			parent.id === id)
	) {
		return false;
	}

	if (isFunction(parent)) {
		// function declaration/expression id
		if ((parent as any).id === id) {
			return false;
		}
		// params list
		if (parent.params.includes(id)) {
			return false;
		}
	}

	// class method name
	if (parent.type === "MethodDefinition" && !parent.computed) {
		return false;
	}

	// property key
	if (isStaticPropertyKey(id, parent)) {
		return false;
	}

	// object destructuring pattern
	if (isNodeInPattern(parent) && parent.value === id) {
		return false;
	}

	// non-assignment array destructuring pattern
	if (
		parent.type === "ArrayPattern" &&
		!isInDestructuringAssignment(parent, parentStack)
	) {
		return false;
	}

	// member expression property
	if (
		parent.type === "MemberExpression" &&
		parent.property === id &&
		!parent.computed
	) {
		return false;
	}

	if (parent.type === "ExportSpecifier") {
		return false;
	}

	// is a special keyword but parsed as identifier
	if (id.name === "arguments") {
		return false;
	}

	return true;
}

const functionNodeTypeRE = /Function(?:Expression|Declaration)$|Method$/;
function isFunction(node: estree.Node): node is FunctionNode {
	return functionNodeTypeRE.test(node.type);
}

const scopeNodeTypeRE =
	/(?:Function|Class)(?:Expression|Declaration)$|Method$|^IfStatement$/;
function findParentScope(
	parentStack: estree.Node[],
	isVar = false,
): estree.Node | undefined {
	const regex = isVar ? functionNodeTypeRE : scopeNodeTypeRE;
	return parentStack.find((i) => regex.test(i.type));
}
