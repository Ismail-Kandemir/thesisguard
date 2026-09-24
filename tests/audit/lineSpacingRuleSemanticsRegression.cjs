const fs = require("fs");
const path = require("path");
const ts = require(path.join(process.cwd(), "node_modules", "typescript"));

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      resolveJsonModule: true,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  module._compile(output, filename);
};

installMinimalXmlDomParser();

const { parseDocumentXml } = require("../../src/features/analysis/parsers/documentXmlParser.ts");
const { parseStylesXml } = require("../../src/features/analysis/parsers/stylesXmlParser.ts");
const { LineSpacingValidator } = require("../../src/features/analysis/rules/validators/LineSpacingValidator.ts");
const { ObjectCaptionFormatValidator } = require("../../src/features/analysis/rules/validators/ObjectCaptionFormatValidator.ts");

function installMinimalXmlDomParser() {
  if (typeof globalThis.DOMParser !== "undefined") return;

  class XmlNode {
    constructor(localName, namespaceURI, attributes, parentElement, namespaceDeclarations = {}) {
      this.localName = localName;
      this.namespaceURI = namespaceURI;
      this.attributes = attributes;
      this.parentElement = parentElement;
      this.children = [];
      this._text = "";
      this.namespaceDeclarations = namespaceDeclarations;
    }

    get textContent() {
      return this._text + this.children.map((child) => child.textContent).join("");
    }

    getElementsByTagNameNS(namespaceURI, localName) {
      const matches = [];
      for (const child of this.children) {
        if (
          (namespaceURI === "*" || child.namespaceURI === namespaceURI) &&
          (localName === "*" || child.localName === localName)
        ) {
          matches.push(child);
        }
        matches.push(...child.getElementsByTagNameNS(namespaceURI, localName));
      }
      return asNodeList(matches);
    }

    getAttributeNS(namespaceURI, localName) {
      const found = this.attributes.find(
        (attribute) => attribute.localName === localName && attribute.namespaceURI === namespaceURI,
      );
      return found ? found.value : null;
    }

    getAttribute(name) {
      const found = this.attributes.find((attribute) => attribute.name === name);
      return found ? found.value : null;
    }

    lookupNamespaceURI(prefix) {
      if (Object.prototype.hasOwnProperty.call(this.namespaceDeclarations, prefix)) {
        return this.namespaceDeclarations[prefix];
      }

      return this.parentElement?.lookupNamespaceURI(prefix) ?? null;
    }
  }

  class XmlDocument extends XmlNode {
    constructor(children) {
      super("#document", null, [], null);
      this.children = children;
      for (const child of children) child.parentElement = null;
    }

    querySelector(selector) {
      return selector === "parsererror"
        ? this.getElementsByTagNameNS("*", "parsererror").item(0)
        : null;
    }
  }

  globalThis.DOMParser = class DOMParser {
    parseFromString(xml) {
      try {
        return parseXml(xml);
      } catch {
        return new XmlDocument([new XmlNode("parsererror", null, [], null)]);
      }
    }
  };

  function parseXml(xml) {
    const root = new XmlDocument([]);
    const stack = [{ node: root, namespaces: {} }];
    const tokenPattern = /<[^>]+>|[^<]+/g;
    let match;

    while ((match = tokenPattern.exec(xml)) !== null) {
      const token = match[0];
      const current = stack[stack.length - 1];

      if (token.startsWith("<?") || token.startsWith("<!--") || token.startsWith("<!")) {
        continue;
      }

      if (token.startsWith("</")) {
        stack.pop();
        continue;
      }

      if (token.startsWith("<")) {
        const selfClosing = /\/>\s*$/.test(token);
        const body = token.slice(1, selfClosing ? -2 : -1).trim();
        const nameMatch = /^([^\s/>]+)/.exec(body);
        if (!nameMatch) continue;
        const qualifiedName = nameMatch[1];
        const namespaceScope = { ...current.namespaces };
        const rawAttributes = parseAttributes(body.slice(qualifiedName.length));

        for (const attribute of rawAttributes) {
          if (attribute.name === "xmlns") {
            namespaceScope[""] = attribute.value;
          } else if (attribute.name.startsWith("xmlns:")) {
            namespaceScope[attribute.name.slice("xmlns:".length)] = attribute.value;
          }
        }

        const { prefix, localName } = splitName(qualifiedName);
        const attributes = rawAttributes
          .filter((attribute) => attribute.name !== "xmlns" && !attribute.name.startsWith("xmlns:"))
          .map((attribute) => {
            const parts = splitName(attribute.name);
            return {
              name: attribute.name,
              localName: parts.localName,
              namespaceURI: namespaceScope[parts.prefix] ?? null,
              value: decodeEntities(attribute.value),
            };
          });
        const node = new XmlNode(
          localName,
          namespaceScope[prefix] ?? null,
          attributes,
          current.node,
          namespaceScope,
        );
        current.node.children.push(node);

        if (!selfClosing) stack.push({ node, namespaces: namespaceScope });
      } else {
        current.node._text += decodeEntities(token);
      }
    }

    return root;
  }

  function parseAttributes(value) {
    const attributes = [];
    const attributePattern = /([^\s=]+)\s*=\s*"([^"]*)"/g;
    let match;
    while ((match = attributePattern.exec(value)) !== null) {
      attributes.push({ name: match[1], value: match[2] });
    }
    return attributes;
  }

  function splitName(name) {
    const index = name.indexOf(":");
    return index === -1
      ? { prefix: "", localName: name }
      : { prefix: name.slice(0, index), localName: name.slice(index + 1) };
  }

  function decodeEntities(value) {
    return value
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, "\"")
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&");
  }

  function asNodeList(items) {
    items.item = (index) => items[index] ?? null;
    return items;
  }
}

const BODY_RULE = {
  id: "audit.body-line-spacing",
  type: "LINE_SPACING",
  title: "Body line spacing",
  description: "Audit rule",
  category: "format",
  expected: { value: 1.5 },
  severity: "error",
  score: 1,
  message: "Audit",
  solution: "Audit",
  enabled: true,
  version: "audit",
};

const CAPTION_RULE = {
  id: "audit.table-caption-format",
  type: "OBJECT_CAPTION_FORMAT",
  title: "Table caption format",
  description: "Audit rule",
  category: "format",
  expected: { object: "table", alignment: "left", lineSpacing: 1 },
  severity: "error",
  score: 1,
  message: "Audit",
  solution: "Audit",
  enabled: true,
  version: "audit",
};

function main() {
  assertBody();
  assertCaption();
  console.log(JSON.stringify({
    phase: "line-spacing-lineRule-semantics",
    result: "PASS",
    scenarios: 14,
  }, null, 2));
}

function assertBody() {
  assertBodyStatus(
    "auto + 360",
    bodyDocument(paragraph({ line: 360, lineRule: "auto" })),
    "PASSED",
  );

  assertBodyStatus(
    "missing lineRule + 360",
    bodyDocument(paragraph({ line: 360 })),
    "PASSED",
  );

  assertBodyUnsupported(
    "exact + 360",
    bodyDocument(paragraph({ line: 360, lineRule: "exact" })),
    "exact",
  );

  assertBodyUnsupported(
    "atLeast + 360",
    bodyDocument(paragraph({ line: 360, lineRule: "atLeast" })),
    "atLeast",
  );

  assertBodyUnsupported(
    "unknown lineRule",
    bodyDocument(paragraph({ line: 360, lineRule: "mystery" })),
    "unknown",
  );

  assertBodyStatus(
    "style inheritance auto",
    withStyles(
      bodyDocument(paragraph({ styleId: "BodyStyle" })),
      stylesXml({ styles: [style("BodyStyle", { line: 360, lineRule: "auto" })] }),
    ),
    "PASSED",
  );

  assertBodyStatus(
    "default paragraph style auto",
    withStyles(
      bodyDocument(paragraph({})),
      stylesXml({
        defaultStyleId: "Normal",
        styles: [style("Normal", { line: 360, lineRule: "auto", isDefault: true })],
      }),
    ),
    "PASSED",
  );

  assertBodyUnsupported(
    "inherited exact",
    withStyles(
      bodyDocument(paragraph({ styleId: "ExactStyle" })),
      stylesXml({ styles: [style("ExactStyle", { line: 360, lineRule: "exact" })] }),
    ),
    "exact",
  );

  assertBodyUnsupported(
    "inherited atLeast",
    withStyles(
      bodyDocument(paragraph({})),
      stylesXml({
        defaultStyleId: "AtLeastNormal",
        styles: [style("AtLeastNormal", { line: 360, lineRule: "atLeast", isDefault: true })],
      }),
    ),
    "atLeast",
  );
}

function assertCaption() {
  assertCaptionStatus(
    "caption auto",
    captionDocument({ line: 240, lineRule: "auto" }),
    "PASSED",
  );

  assertCaptionStatus(
    "caption missing lineRule",
    captionDocument({ line: 240 }),
    "PASSED",
  );

  assertCaptionUnsupported(
    "caption exact",
    captionDocument({ line: 240, lineRule: "exact" }),
    "exact",
  );

  assertCaptionUnsupported(
    "caption atLeast",
    captionDocument({ line: 240, lineRule: "atLeast" }),
    "atLeast",
  );

  assertCaptionUnsupported(
    "caption unknown",
    captionDocument({ line: 240, lineRule: "mystery" }),
    "unknown",
  );
}

function assertBodyStatus(label, document, expectedStatus) {
  const result = new LineSpacingValidator().validate(document, BODY_RULE);
  assertEqual(result.status, expectedStatus, `${label}: body status`);
}

function assertBodyUnsupported(label, document, expectedRule) {
  const result = new LineSpacingValidator().validate(document, BODY_RULE);
  assertEqual(result.status, "FAILED", `${label}: body status`);
  assertEqual(result.passed, false, `${label}: body passed flag`);
  assertUnresolvedDiagnostic(result.message, `${label}: body diagnostic`);
  assertIncludes(result.message, expectedRule, `${label}: body lineRule`);
}

function assertCaptionStatus(label, document, expectedStatus) {
  const result = new ObjectCaptionFormatValidator().validate(document, CAPTION_RULE);
  assertEqual(result.status, expectedStatus, `${label}: caption status`);
}

function assertCaptionUnsupported(label, document, expectedRule) {
  const result = new ObjectCaptionFormatValidator().validate(document, CAPTION_RULE);
  assertEqual(result.status, "FAILED", `${label}: caption status`);
  assertEqual(result.passed, false, `${label}: caption passed flag`);
  assertUnresolvedDiagnostic(result.message, `${label}: caption diagnostic`);
  assertIncludes(result.message, expectedRule, `${label}: caption lineRule`);
}

function bodyDocument(paragraphXml) {
  return parseDocumentXml(documentXml(paragraphXml));
}

function captionDocument(spacing) {
  return parseDocumentXml(documentXml(
    captionParagraph(spacing) +
    "<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Hucre</w:t></w:r></w:p></w:tc></w:tr></w:tbl>",
  ));
}

function withStyles(document, styles) {
  return {
    ...document,
    styles: styles.styles,
    documentDefaults: styles.documentDefaults,
  };
}

function stylesXml({ styles = [] }) {
  return parseStylesXml(
    `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${styles.join("")}</w:styles>`,
  );
}

function style(id, options) {
  const defaultAttribute = options.isDefault ? ' w:default="1"' : "";
  const basedOn = options.basedOn ? `<w:basedOn w:val="${options.basedOn}"/>` : "";
  return [
    `<w:style w:type="paragraph" w:styleId="${id}"${defaultAttribute}>`,
    `<w:name w:val="${id}"/>`,
    basedOn,
    "<w:pPr>",
    spacing(options),
    "</w:pPr>",
    "</w:style>",
  ].join("");
}

function paragraph(options) {
  const pStyle = options.styleId ? `<w:pStyle w:val="${options.styleId}"/>` : "";
  const spacingXml = options.line === undefined ? "" : spacing(options);
  const paragraphProperties = pStyle || spacingXml
    ? `<w:pPr>${pStyle}${spacingXml}</w:pPr>`
    : "";
  return `<w:p>${paragraphProperties}<w:r><w:t>Akademik metin</w:t></w:r></w:p>`;
}

function captionParagraph(options) {
  return `<w:p><w:pPr><w:jc w:val="left"/>${spacing(options)}</w:pPr><w:r><w:t>Tablo 1. Deney</w:t></w:r></w:p>`;
}

function spacing(options) {
  if (options.line === undefined) {
    return "";
  }

  const lineRule = options.lineRule === undefined ? "" : ` w:lineRule="${options.lineRule}"`;
  return `<w:spacing w:line="${options.line}"${lineRule}/>`;
}

function documentXml(content) {
  return `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${content}</w:body></w:document>`;
}

function assertIncludes(actual, expected, message) {
  if (!actual.includes(expected)) {
    throw new Error(`${message}: expected "${actual}" to include "${expected}"`);
  }
}

function assertUnresolvedDiagnostic(actual, message) {
  if (!actual.includes("guvenle dogrulanamadi") && !actual.includes("güvenle doğrulanamadı")) {
    throw new Error(`${message}: expected "${actual}" to describe unresolved static validation`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
}

main();
