const TAG = /^(Workaround|Spec|Perf|Security):\s*\S/
const SUPPRESSION = /^(oxlint|eslint)-disable(-next-line|-line)?\b/
const SUPPRESSION_REASON = /\s--\s*\S/
const TS_EXPECT_ERROR = /^@ts-expect-error\b/
const TS_EXPECT_ERROR_REASON = /^@ts-expect-error\s+(--\s*)?\S/
const TOOL_DIRECTIVES = [
  /^(oxlint|eslint)-enable\b/,
  /^prettier-ignore\b/,
  /^[#@]__(PURE|NO_SIDE_EFFECTS)__/,
  /^@vite-ignore\b/,
  /^webpack[A-Z]\w*:/,
  /^@jsx(ImportSource|Runtime|Frag)?\b/,
  /^(c8|v8|istanbul) ignore\b/,
  /^\/\s*<reference\s/,
  /^@ts-check\b/,
]

const TYPE_MEMBERS = new Set([
  "TSPropertySignature",
  "TSMethodSignature",
  "TSIndexSignature",
  "TSCallSignatureDeclaration",
  "TSConstructSignatureDeclaration",
  "TSEnumMember",
  "PropertyDefinition",
  "MethodDefinition",
  "AccessorProperty",
  "TSAbstractPropertyDefinition",
  "TSAbstractMethodDefinition",
])

const DECLARATIONS = new Set([
  "FunctionDeclaration",
  "ClassDeclaration",
  "VariableDeclaration",
  "TSTypeAliasDeclaration",
  "TSInterfaceDeclaration",
  "TSEnumDeclaration",
  "TSModuleDeclaration",
  "TSDeclareFunction",
])

function start(node) {
  return node.range ? node.range[0] : node.start
}

function end(node) {
  return node.range ? node.range[1] : node.end
}

function keyName(property) {
  return property.key?.type === "Identifier" ? property.key.name : undefined
}

function enclosingFunction(node) {
  let current = node.parent
  while (current && !current.type.includes("Function")) current = current.parent
  return current
}

function isPrimitiveApiMember(property) {
  const object = property.parent
  if (object?.type !== "ObjectExpression") return false
  const holder = object.parent
  const returned = holder?.type === "ReturnStatement"
  const arrowBody = holder?.type === "ArrowFunctionExpression" && holder.body === object
  const namedApi = holder?.type === "VariableDeclarator" && holder.id?.name === "api"
  if (!returned && !arrowBody && !namedApi) return false
  const builder = arrowBody ? holder : enclosingFunction(holder)
  return builder?.parent?.type === "Property" && keyName(builder.parent) === "api"
}

function commentText(comment) {
  if (comment.type === "Line") return comment.value.trim()
  return comment.value
    .replace(/^\*/, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\*?\s?/, "").trim())
    .filter(Boolean)
    .join(" ")
}

function declaredNames(declaration) {
  if (declaration.type === "VariableDeclaration")
    return declaration.declarations.flatMap((declarator) =>
      declarator.id.type === "Identifier" ? [declarator.id.name] : [],
    )
  return declaration.id?.type === "Identifier" ? [declaration.id.name] : []
}

function directiveVerdict(text) {
  if (SUPPRESSION.test(text))
    return SUPPRESSION_REASON.test(text) ? "allowed" : "A suppression says why: `-- <reason>` after the rule."
  if (TS_EXPECT_ERROR.test(text))
    return TS_EXPECT_ERROR_REASON.test(text) ? "allowed" : "`@ts-expect-error` says why: `-- <reason>`."
  if (TOOL_DIRECTIVES.some((directive) => directive.test(text))) return "allowed"
  return undefined
}

function isLicense(comment) {
  return comment.type === "Block" && (comment.value.startsWith("!") || comment.value.includes("@license"))
}

function isJsdoc(comment) {
  return comment.type === "Block" && comment.value.startsWith("*") && !comment.value.startsWith("**")
}

function nextCodeOffset(text, comments, index) {
  let offset = end(comments[index])
  let next = index + 1
  for (;;) {
    while (offset < text.length && /\s/.test(text[offset])) offset++
    if (next < comments.length && start(comments[next]) === offset) {
      offset = end(comments[next])
      next++
    } else {
      return offset
    }
  }
}

function continuesPrevious(text, previous, comment) {
  if (!previous || previous.type !== "Line" || comment.type !== "Line") return false
  if (comment.loc.start.line !== previous.loc.end.line + 1) return false
  if (text.slice(end(previous), start(comment)).trim() !== "") return false
  const lineStart = text.lastIndexOf("\n", start(previous)) + 1
  return text.slice(lineStart, start(previous)).trim() === ""
}

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Code describes itself. A comment says only what code can't, tagged Workaround:, Spec:, Perf: or Security:.",
    },
  },
  create(context) {
    const documented = new Set()
    const declarations = []
    const exported = new Set()

    const visitTypeMember = (node) => documented.add(start(node))

    return {
      ...Object.fromEntries([...TYPE_MEMBERS].map((type) => [type, visitTypeMember])),
      Property(node) {
        if (isPrimitiveApiMember(node)) documented.add(start(node))
      },
      Program(program) {
        for (const statement of program.body) {
          if (statement.type === "ExportNamedDeclaration" || statement.type === "ExportDefaultDeclaration") {
            documented.add(start(statement))
            if (statement.type === "ExportNamedDeclaration")
              for (const specifier of statement.specifiers ?? [])
                if (specifier.local?.type === "Identifier") exported.add(specifier.local.name)
            if (statement.type === "ExportDefaultDeclaration" && statement.declaration.type === "Identifier")
              exported.add(statement.declaration.name)
          } else if (DECLARATIONS.has(statement.type)) {
            declarations.push(statement)
          }
        }
      },
      "Program:exit"() {
        for (const declaration of declarations)
          if (declaredNames(declaration).some((name) => exported.has(name))) documented.add(start(declaration))

        const { sourceCode } = context
        const text = sourceCode.text
        const comments = sourceCode.getAllComments()
        let headVerdict = "allowed"
        comments.forEach((comment, index) => {
          if (continuesPrevious(text, comments[index - 1], comment)) {
            if (headVerdict !== "allowed") return
            const continuation = directiveVerdict(comment.value.trim())
            if (continuation && continuation !== "allowed") report(comment, continuation)
            return
          }
          headVerdict = verdict(comment, index)
          if (headVerdict !== "allowed") report(comment, headVerdict)
        })

        function verdict(comment, index) {
          const commentBody = commentText(comment)
          if (TAG.test(commentBody)) return "allowed"
          const directive = directiveVerdict(commentBody)
          if (directive) return directive
          if (isLicense(comment)) return "allowed"
          if (isJsdoc(comment)) {
            if (documented.has(nextCodeOffset(text, comments, index))) return "allowed"
            return "JSDoc belongs on an exported declaration, a type member or a primitive's `api` member, and only for a contract its name and type can't state. Rename or extract instead."
          }
          return "Make the code say it (rename, extract a named function, constant or boolean) and delete the comment. Keep one only for what code can't express, starting with Workaround:, Spec:, Perf: or Security:."
        }

        function report(comment, message) {
          context.report({ loc: comment.loc, message })
        }
      },
    }
  },
}
