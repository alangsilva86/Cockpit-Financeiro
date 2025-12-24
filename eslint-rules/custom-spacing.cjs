const allowedSpacing = new Set(['0', '1', '2', '4', '6', '8', '10', '12', '14', '16']);
const spacingPatterns = [
  /^(?:[mp](?:[trblxy])?)-(.+)$/,
  /^(?:gap(?:-x|-y)?|space-(?:x|y))-(.+)$/,
];

const getClassNames = (attribute) => {
  if (!attribute?.value) return [];
  const { value } = attribute;
  if (value.type === 'Literal' && typeof value.value === 'string') {
    return value.value.split(/\s+/).filter(Boolean);
  }

  if (value.type === 'JSXExpressionContainer') {
    const { expression } = value;
    if (expression.type === 'Literal' && typeof expression.value === 'string') {
      return expression.value.split(/\s+/).filter(Boolean);
    }
    if (expression.type === 'TemplateLiteral') {
      return expression.quasis
        .map((quasi) => quasi.value.cooked)
        .join(' ')
        .split(/\s+/)
        .filter(Boolean);
    }
  }

  return [];
};

const spacingRule = {
  meta: {
    type: 'layout',
    docs: {
      description: 'Enforce the 8pt spacing scale for padding, margin, gap, and space utilities.',
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        const name = node.name?.name;
        if (name !== 'className') return;
        const classes = getClassNames(node);
        classes.forEach((cls) => {
          for (const pattern of spacingPatterns) {
            const match = cls.match(pattern);
            if (!match) continue;
            const token = match[1];
            if (token.includes('[')) {
              context.report({
                node,
                message: `Avoid arbitrary spacing tokens like '${cls}'. Use one of the approved grid tokens.`,
              });
              return;
            }

            if (!allowedSpacing.has(token) && token !== 'auto') {
              context.report({
                node,
                message: `'${cls}' is not on the 8pt spacing grid. Use 0, 1, 2, 4, 6, 8, 10, 12, 14, or 16.`,
              });
            }
            return;
          }
        });
      },
    };
  },
};

const iconClickRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow clickable icon elements unless they use IconButton.',
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const hasOnClick = node.attributes.some(
          (attr) => attr.type === 'JSXAttribute' && attr.name?.name === 'onClick'
        );
        if (!hasOnClick) return;

        const { name } = node;
        const isIconsElement =
          name.type === 'JSXMemberExpression' && name.object?.name === 'Icons';
        const isSvgElement = name.type === 'JSXIdentifier' && name.name === 'svg';

        if (isIconsElement || isSvgElement) {
          context.report({
            node,
            message: 'Wrap tappable iconography in IconButton to ensure sufficient hit area.',
          });
        }
      },
    };
  },
};

module.exports = {
  rules: {
    'avoid-illegal-spacing': spacingRule,
    'no-direct-icon-click': iconClickRule,
  },
};
