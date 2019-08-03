'use strict'

import * as TypeConverters from './vscode-converters'
import {CancellationToken, editor, languages, Position as _Position} from 'monaco-editor';

import {TextDocument, TextEditor,} from './vscode-monaco'

import {Range, SnippetString, Position} from './extHostTypes'

import {slugify} from './util';
import {buildToc} from './toc';

let completionActivated = false

export function activateCompletion(editor: TextEditor) {
    if (!completionActivated) {
        //TODO: remove provider when context is disposed
        let provider = new MdCompletionItemProvider();
        languages.registerCompletionItemProvider(editor.languageId, provider);

        // @ts-ignore
        editor.editor.onDidType((text:string) => {
            // for some reason monaco doesn't trigger completion for '//' when it is registered as triggerCharacter
            const lastChar = text.charAt(text.length - 1);
            if (lastChar === "\\") {
                editor.editor.trigger('keyboard', 'editor.action.triggerSuggest', {})
            }
        });
        completionActivated = true;

    }
}

function completionList(items: languages.CompletionItem[]): languages.CompletionList {
    return {suggestions: items.map((v, _,) => Object.assign({}, v))};
}

function newCompletionItem(text: string, kind: languages.CompletionItemKind): languages.CompletionItem {
    return {
        label: text,
        kind: kind,
        additionalTextEdits: undefined,
        command: undefined,
        commitCharacters: undefined,
        detail: undefined,
        documentation: undefined,
        filterText: undefined,
        insertTextRules: undefined,
        preselect: false,
        range: undefined,
        sortText: undefined,
        insertText: undefined
    }
}

class MdCompletionItemProvider implements languages.CompletionItemProvider {
    triggerCharacters: ['(', '\\', '/', '[', '#']

    // Suffixes explained:
    // \cmd         -> 0
    // \cmd{$1}     -> 1
    // \cmd{$1}{$2} -> 2
    //
    // Use linebreak to mimic the structure of the KaTeX [Support Table](https://katex.org/docs/supported.html)
    accents1 = [
        'tilde', 'mathring',
        'widetilde', 'overgroup',
        'utilde', 'undergroup',
        'acute', 'vec', 'Overrightarrow',
        'bar', 'overleftarrow', 'overrightarrow',
        'breve', 'underleftarrow', 'underrightarrow',
        'check', 'overleftharpoon', 'overrightharpoon',
        'dot', 'overleftrightarrow', 'overbrace',
        'ddot', 'underleftrightarrow', 'underbrace',
        'grave', 'overline', 'overlinesegment',
        'hat', 'underline', 'underlinesegment',
        'widehat', 'widecheck'
    ];
    delimiters0 = [
        'lparen', 'rparen', 'lceil', 'rceil', 'uparrow',
        'lbrack', 'rbrack', 'lfloor', 'rfloor', 'downarrow', 'updownarrow',
        'langle', 'rangle', 'lgroup', 'rgroup', 'Uparrow',
        'vert', 'ulcorner', 'urcorner', 'Downarrow',
        'Vert', 'llcorner', 'lrcorner', 'Updownarrow',
        'lvert', 'rvert', 'lVert', 'rVert', 'backslash',
        'lang', 'rang', 'lt', 'gt'
    ];
    delimeterSizing0 = [
        'left', 'big', 'bigl', 'bigm', 'bigr',
        'middle', 'Big', 'Bigl', 'Bigm', 'Bigr',
        'right', 'bigg', 'biggl', 'biggm', 'biggr',
        'Bigg', 'Biggl', 'Biggm', 'Biggr'
    ];
    greekLetters0 = [
        'Alpha', 'Beta', 'Gamma', 'Delta',
        'Epsilon', 'Zeta', 'Eta', 'Theta',
        'Iota', 'Kappa', 'Lambda', 'Mu',
        'Nu', 'Xi', 'Omicron', 'Pi',
        'Sigma', 'Tau', 'Upsilon', 'Phi',
        'Chi', 'Psi', 'Omega',
        'varGamma', 'varDelta', 'varTheta', 'varLambda',
        'varXi', 'varPi', 'varSigma', 'varUpsilon',
        'varPhi', 'varPsi', 'varOmega',
        'alpha', 'beta', 'gamma', 'delta',
        'epsilon', 'zeta', 'eta', 'theta',
        'iota', 'kappa', 'lambda', 'mu',
        'nu', 'xi', 'omicron', 'pi',
        'rho', 'sigma', 'tau', 'upsilon',
        'phi', 'chi', 'psi', 'omega',
        'varepsilon', 'varkappa', 'vartheta', 'thetasym',
        'varpi', 'varrho', 'varsigma', 'varphi',
        'digamma'
    ];
    otherLetters0 = [
        'imath', 'nabla', 'Im', 'Reals',
        'jmath', 'partial', 'image', 'wp',
        'aleph', 'Game', 'Bbbk', 'weierp',
        'alef', 'Finv', 'N', 'Z',
        'alefsym', 'cnums', 'natnums',
        'beth', 'Complex', 'R',
        'gimel', 'ell', 'Re',
        'daleth', 'hbar', 'real',
        'eth', 'hslash', 'reals'
    ];
    annotation1 = [
        'cancel', 'overbrace',
        'bcancel', 'underbrace',
        'xcancel', 'not =',
        'sout', 'boxed',
        'tag', 'tag*'
    ];
    verticalLayout0 = ['atop']
    verticalLayout2 = ['stackrel', 'overset', 'underset', 'raisebox'];
    overlap1 = ['mathllap', 'mathrlap', 'mathclap', 'llap', 'rlap', 'clap', 'smash'];
    spacing0 = [
        'thinspace', 'medspace', 'thickspace', 'enspace',
        'quad', 'qquad', 'negthinspace', 'negmedspace',
        'nobreakspace', 'negthickspace'
    ];
    spacing1 = [
        'kern', 'mkern', 'mskip', 'hskip',
        'hspace', 'hspace*', 'phantom', 'hphantom', 'vphantom'
    ];
    logicAndSetTheory0 = [
        'forall', 'complement', 'therefore', 'emptyset',
        'exists', 'subset', 'because', 'empty',
        'exist', 'supset', 'mapsto', 'varnothing',
        'nexists', 'mid', 'to', 'implies',
        'in', 'land', 'gets', 'impliedby',
        'isin', 'lor', 'leftrightarrow', 'iff',
        'notin', 'ni', 'notni', 'neg', 'lnot'
    ];
    bigOperators0 = [
        'sum', 'prod', 'bigotimes', 'bigvee',
        'int', 'coprod', 'bigoplus', 'bigwedge',
        'iint', 'intop', 'bigodot', 'bigcap',
        'iiint', 'smallint', 'biguplus', 'bigcup',
        'oint', 'oiint', 'oiiint', 'bigsqcup'
    ];
    binaryOperators0 = [
        'cdot', 'gtrdot', 'pmod',
        'cdotp', 'intercal', 'pod',
        'centerdot', 'land', 'rhd',
        'circ', 'leftthreetimes', 'rightthreetimes',
        'amalg', 'circledast', 'ldotp', 'rtimes',
        'And', 'circledcirc', 'lor', 'setminus',
        'ast', 'circleddash', 'lessdot', 'smallsetminus',
        'barwedge', 'Cup', 'lhd', 'sqcap',
        'bigcirc', 'cup', 'ltimes', 'sqcup',
        'bmod', 'curlyvee', 'times',
        'boxdot', 'curlywedge', 'mp', 'unlhd',
        'boxminus', 'div', 'odot', 'unrhd',
        'boxplus', 'divideontimes', 'ominus', 'uplus',
        'boxtimes', 'dotplus', 'oplus', 'vee',
        'bullet', 'doublebarwedge', 'otimes', 'veebar',
        'Cap', 'doublecap', 'oslash', 'wedge',
        'cap', 'doublecup', 'pm', 'plusmn', 'wr'
    ];
    fractions0 = ['over', 'above'];
    fractions2 = ['frac', 'dfrac', 'tfrac', 'cfrac', 'genfrac'];
    binomialCoefficients0 = ['choose'];
    binomialCoefficients2 = ['binom', 'dbinom', 'tbinom', 'brace', 'brack'];
    mathOperators0 = [
        'arcsin', 'cotg', 'ln', 'det',
        'arccos', 'coth', 'log', 'gcd',
        'arctan', 'csc', 'sec', 'inf',
        'arctg', 'ctg', 'sin', 'lim',
        'arcctg', 'cth', 'sinh', 'liminf',
        'arg', 'deg', 'sh', 'limsup',
        'ch', 'dim', 'tan', 'max',
        'cos', 'exp', 'tanh', 'min',
        'cosec', 'hom', 'tg', 'Pr',
        'cosh', 'ker', 'th', 'sup',
        'cot', 'lg', 'argmax',
        'argmin', 'limits'
    ];
    mathOperators1 = ['operatorname'];
    sqrt1 = ['sqrt'];
    relations0 = [
        'eqcirc', 'lesseqgtr', 'sqsupset',
        'eqcolon', 'lesseqqgtr', 'sqsupseteq',
        'Eqcolon', 'lessgtr', 'Subset',
        'eqqcolon', 'lesssim', 'subset',
        'approx', 'Eqqcolon', 'll', 'subseteq', 'sube',
        'approxeq', 'eqsim', 'lll', 'subseteqq',
        'asymp', 'eqslantgtr', 'llless', 'succ',
        'backepsilon', 'eqslantless', 'lt', 'succapprox',
        'backsim', 'equiv', 'mid', 'succcurlyeq',
        'backsimeq', 'fallingdotseq', 'models', 'succeq',
        'between', 'frown', 'multimap', 'succsim',
        'bowtie', 'ge', 'owns', 'Supset',
        'bumpeq', 'geq', 'parallel', 'supset',
        'Bumpeq', 'geqq', 'perp', 'supseteq',
        'circeq', 'geqslant', 'pitchfork', 'supseteqq',
        'colonapprox', 'gg', 'prec', 'thickapprox',
        'Colonapprox', 'ggg', 'precapprox', 'thicksim',
        'coloneq', 'gggtr', 'preccurlyeq', 'trianglelefteq',
        'Coloneq', 'gt', 'preceq', 'triangleq',
        'coloneqq', 'gtrapprox', 'precsim', 'trianglerighteq',
        'Coloneqq', 'gtreqless', 'propto', 'varpropto',
        'colonsim', 'gtreqqless', 'risingdotseq', 'vartriangle',
        'Colonsim', 'gtrless', 'shortmid', 'vartriangleleft',
        'cong', 'gtrsim', 'shortparallel', 'vartriangleright',
        'curlyeqprec', 'in', 'sim', 'vcentcolon',
        'curlyeqsucc', 'Join', 'simeq', 'vdash',
        'dashv', 'le', 'smallfrown', 'vDash',
        'dblcolon', 'leq', 'smallsmile', 'Vdash',
        'doteq', 'leqq', 'smile', 'Vvdash',
        'Doteq', 'leqslant', 'sqsubset',
        'doteqdot', 'lessapprox', 'sqsubseteq'
    ];
    negatedRelations0 = [
        'gnapprox', 'ngeqslant', 'nsubseteq', 'precneqq',
        'gneq', 'ngtr', 'nsubseteqq', 'precnsim',
        'gneqq', 'nleq', 'nsucc', 'subsetneq',
        'gnsim', 'nleqq', 'nsucceq', 'subsetneqq',
        'gvertneqq', 'nleqslant', 'nsupseteq', 'succnapprox',
        'lnapprox', 'nless', 'nsupseteqq', 'succneqq',
        'lneq', 'nmid', 'ntriangleleft', 'succnsim',
        'lneqq', 'notin', 'ntrianglelefteq', 'supsetneq',
        'lnsim', 'notni', 'ntriangleright', 'supsetneqq',
        'lvertneqq', 'nparallel', 'ntrianglerighteq', 'varsubsetneq',
        'ncong', 'nprec', 'nvdash', 'varsubsetneqq',
        'ne', 'npreceq', 'nvDash', 'varsupsetneq',
        'neq', 'nshortmid', 'nVDash', 'varsupsetneqq',
        'ngeq', 'nshortparallel', 'nVdash',
        'ngeqq', 'nsim', 'precnapprox'
    ];
    arrows0 = [
        'circlearrowleft', 'leftharpoonup', 'rArr',
        'circlearrowright', 'leftleftarrows', 'rarr',
        'curvearrowleft', 'leftrightarrow', 'restriction',
        'curvearrowright', 'Leftrightarrow', 'rightarrow',
        'Darr', 'leftrightarrows', 'Rightarrow',
        'dArr', 'leftrightharpoons', 'rightarrowtail',
        'darr', 'leftrightsquigarrow', 'rightharpoondown',
        'dashleftarrow', 'Lleftarrow', 'rightharpoonup',
        'dashrightarrow', 'longleftarrow', 'rightleftarrows',
        'downarrow', 'Longleftarrow', 'rightleftharpoons',
        'Downarrow', 'longleftrightarrow', 'rightrightarrows',
        'downdownarrows', 'Longleftrightarrow', 'rightsquigarrow',
        'downharpoonleft', 'longmapsto', 'Rrightarrow',
        'downharpoonright', 'longrightarrow', 'Rsh',
        'gets', 'Longrightarrow', 'searrow',
        'Harr', 'looparrowleft', 'swarrow',
        'hArr', 'looparrowright', 'to',
        'harr', 'Lrarr', 'twoheadleftarrow',
        'hookleftarrow', 'lrArr', 'twoheadrightarrow',
        'hookrightarrow', 'lrarr', 'Uarr',
        'iff', 'Lsh', 'uArr',
        'impliedby', 'mapsto', 'uarr',
        'implies', 'nearrow', 'uparrow',
        'Larr', 'nleftarrow', 'Uparrow',
        'lArr', 'nLeftarrow', 'updownarrow',
        'larr', 'nleftrightarrow', 'Updownarrow',
        'leadsto', 'nLeftrightarrow', 'upharpoonleft',
        'leftarrow', 'nrightarrow', 'upharpoonright',
        'Leftarrow', 'nRightarrow', 'upuparrows',
        'leftarrowtail', 'nwarrow', 'leftharpoondown', 'Rarr'
    ];
    extensibleArrows1 = [
        'xleftarrow', 'xrightarrow',
        'xLeftarrow', 'xRightarrow',
        'xleftrightarrow', 'xLeftrightarrow',
        'xhookleftarrow', 'xhookrightarrow',
        'xtwoheadleftarrow', 'xtwoheadrightarrow',
        'xleftharpoonup', 'xrightharpoonup',
        'xleftharpoondown', 'xrightharpoondown',
        'xleftrightharpoons', 'xrightleftharpoons',
        'xtofrom', 'xmapsto',
        'xlongequal'
    ];
    classAssignment1 = [
        'mathbin', 'mathclose', 'mathinner', 'mathop',
        'mathopen', 'mathord', 'mathpunct', 'mathrel'
    ];
    color2 = ['color', 'textcolor', 'colorbox'];
    font0 = ['rm', 'bf', 'it', 'sf', 'tt'];
    font1 = [
        'mathrm', 'mathbf', 'mathit',
        'mathnormal', 'textbf', 'textit',
        'textrm', 'bold', 'Bbb',
        'textnormal', 'boldsymbol', 'mathbb',
        'text', 'bm', 'frak',
        'mathsf', 'mathtt', 'mathfrak',
        'textsf', 'texttt', 'mathcal', 'mathscr'
    ];
    size0 = [
        'Huge', 'huge', 'LARGE', 'Large', 'large',
        'normalsize', 'small', 'footnotesize', 'scriptsize', 'tiny'
    ];
    style0 = [
        'displaystyle', 'textstyle', 'scriptstyle', 'scriptscriptstyle',
        'limits', 'nolimits', 'verb'
    ];
    symbolsAndPunctuation0 = [
        'cdots', 'LaTeX',
        'ddots', 'TeX',
        'ldots', 'nabla',
        'vdots', 'infty',
        'dotsb', 'infin',
        'dotsc', 'checkmark',
        'dotsi', 'dag',
        'dotsm', 'dagger',
        'dotso',
        'sdot', 'ddag',
        'mathellipsis', 'ddagger',
        'Box', 'Dagger',
        'lq', 'square', 'angle',
        'blacksquare', 'measuredangle',
        'rq', 'triangle', 'sphericalangle',
        'triangledown', 'top',
        'triangleleft', 'bot',
        'triangleright',
        'colon', 'bigtriangledown',
        'backprime', 'bigtriangleup', 'pounds',
        'prime', 'blacktriangle', 'mathsterling',
        'blacktriangledown',
        'blacktriangleleft', 'yen',
        'blacktriangleright', 'surd',
        'diamond', 'degree',
        'Diamond',
        'lozenge', 'mho',
        'blacklozenge', 'diagdown',
        'star', 'diagup',
        'bigstar', 'flat',
        'clubsuit', 'natural',
        'copyright', 'clubs', 'sharp',
        'circledR', 'diamondsuit', 'heartsuit',
        'diamonds', 'hearts',
        'circledS', 'spadesuit', 'spades',
        'maltese'
    ];

    mathCompletions: languages.CompletionItem[];

    constructor() {
        // \cmd
        let c1 = Array.from(new Set(
            [
                ...this.delimiters0, ...this.delimeterSizing0,
                ...this.greekLetters0, ...this.otherLetters0,
                ...this.spacing0, ...this.verticalLayout0,
                ...this.logicAndSetTheory0, ...this.bigOperators0,
                ...this.binaryOperators0, ...this.binomialCoefficients0,
                ...this.fractions0, ...this.mathOperators0,
                ...this.relations0, ...this.negatedRelations0,
                ...this.arrows0, ...this.font0, ...this.size0,
                ...this.style0, ...this.symbolsAndPunctuation0
            ]
        )).map(cmd => {
            let item = newCompletionItem('\\' + cmd, languages.CompletionItemKind.Function);
            item.insertText = cmd;
            return item;
        });
        // \cmd{$1}
        let c2 = Array.from(new Set(
            [
                ...this.accents1, ...this.annotation1,
                ...this.overlap1, ...this.spacing1,
                ...this.mathOperators1, ...this.sqrt1,
                ...this.extensibleArrows1, ...this.font1,
                ...this.classAssignment1
            ]
        )).map(cmd => {
            let item = newCompletionItem('\\' + cmd, languages.CompletionItemKind.Function);
            item.insertText = new SnippetString(`${cmd}\{$1\}`).value;
            item.insertTextRules = languages.CompletionItemInsertTextRule.InsertAsSnippet

            return item;
        });
        // \cmd{$1}{$2}
        let c3 = Array.from(new Set(
            [
                ...this.verticalLayout2, ...this.binomialCoefficients2,
                ...this.fractions2, ...this.color2
            ]
        )).map(cmd => {
            let item = newCompletionItem('\\' + cmd, languages.CompletionItemKind.Function);
            item.insertText = new SnippetString(`${cmd}\{$1\}\{$2\}`).value;
            item.insertTextRules = languages.CompletionItemInsertTextRule.InsertAsSnippet

            return item;
        });
        let envSnippet = newCompletionItem('\\begin', languages.CompletionItemKind.Snippet);
        envSnippet.insertText = new SnippetString('begin{${1|aligned,alignedat,array,bmatrix,Bmatrix,cases,darray,dcases,gathered,matrix,pmatrix,vmatrix,Vmatrix|}}\n\t$2\n\\end{$1}').value;
        envSnippet.insertTextRules = languages.CompletionItemInsertTextRule.InsertAsSnippet

        this.mathCompletions = [...c1, ...c2, ...c3, envSnippet];
        // Sort
        this.mathCompletions.forEach(item => {
            item.sortText = item.label.replace(/[a-zA-Z]/g, c => {
                if (/[a-z]/.test(c)) {
                    return `0${c}`;
                } else {
                    return `1${c.toLowerCase()}`;
                }
            });
        });
    }

    provideCompletionItems(model: editor.ITextModel, _position: _Position, _context: languages.CompletionContext, _token: CancellationToken): languages.ProviderResult<languages.CompletionList> {
        let document = new TextDocument(model)
        let position = TypeConverters.Position.to(_position)

        const lineTextBefore = document.lineAt(position.line).text.substring(0, position.character);
        const lineTextAfter = document.lineAt(position.line).text.substring(position.character);

        let matches;
        if (
            (matches = lineTextBefore.match(/\\[^$]*$/)) !== null
        ) {
            /* ┌────────────────┐
               │ Math functions │
               └────────────────┘ */
            if (
                /(^|[^\$])\$(|[^ \$].*)\\\w*$/.test(lineTextBefore)
                && lineTextAfter.includes('$')
            ) {
                // Complete math functions (inline math)
                return completionList(this.mathCompletions);
            } else {
                const textBefore = document.getText(new Range(new Position(0, 0), position));
                const textAfter = document.getText().substr(document.offsetAt(position));

                if (
                    (matches = textBefore.match(/\$\$/g)) !== null
                    && matches.length % 2 !== 0
                    && textAfter.includes('\$\$')
                ) {
                    // Complete math functions ($$ ... $$)
                    return completionList(this.mathCompletions)
                } else {
                    return completionList([]);
                }
            }
        } else if (/\[[^\]]*?\]\[[^\]]*$/.test(lineTextBefore)) {
            /* ┌───────────────────────┐
               │ Reference link labels │
               └───────────────────────┘ */
            let startIndex = lineTextBefore.lastIndexOf('[');
            const range = new Range(position.with({character: startIndex + 1}), position);
            return new Promise((res, _) => {
                const lines = document.getText().split(/\r?\n/);
                const usageCounts = lines.reduce((useCounts, currentLine) => {
                    let match: RegExpExecArray;
                    const pattern = /\[[^\]]+\]\[([^\]]*?)\]/g;
                    while ((match = pattern.exec(currentLine)) !== null) {
                        let usedRef = match[1];
                        if (!useCounts.has(usedRef)) {
                            useCounts.set(usedRef, 0);
                        }
                        useCounts.set(usedRef, useCounts.get(usedRef) + 1);
                    }
                    return useCounts;
                }, new Map<string, number>());
                let refLabels = lines.reduce((prev, curr) => {
                    let match;
                    if ((match = /^\[([^\]]*?)\]: (\S*)( .*)?/.exec(curr)) !== null) {
                        const ref = match[1];
                        let item = newCompletionItem(ref, languages.CompletionItemKind.Reference);
                        const usages = usageCounts.get(ref) || 0;
                        item.insertText = ref
                        item.documentation = {value: (match[2])};
                        item.detail = usages === 1 ? `1 usage` : `${usages} usages`;
                        // Prefer unused items
                        item.sortText = usages === 0 ? `0-${ref}` : item.sortText = `1-${ref}`;
                        item.range = TypeConverters.Range.from(range);
                        prev.push(item);
                    }
                    return prev;
                }, []);

                res(completionList(refLabels));
            });
        } else if (/\[[^\]]*\]\(#[^\)]*$/.test(lineTextBefore)) {
            /* ┌───────────────────────────┐
               │ Anchor tags from headings │
               └───────────────────────────┘ */
            let startIndex = lineTextBefore.lastIndexOf('(');
            let endPosition = position;

            let addClosingParen = false;
            if (/^([^\) ]+\s*|^\s*)\)/.test(lineTextAfter)) {
                // try to detect if user wants to replace a link (i.e. matching closing paren and )
                // Either: ... <CURSOR> something <whitespace> )
                //     or: ... <CURSOR> <whitespace> )
                //     or: ... <CURSOR> )     (endPosition assignment is a no-op for this case)

                // in every case, we want to remove all characters after the cursor and before that first closing paren
                endPosition = position.with({character: +endPosition.character + lineTextAfter.indexOf(')')});
            } else {
                // If no closing paren is found, replace all trailing non-white-space chars and add a closing paren
                // distance to first non-whitespace or EOL
                const toReplace = (lineTextAfter.search(/(?<=^\S+)(\s|$)/))
                endPosition = position.with({character: +endPosition.character + toReplace});

                addClosingParen = true;
            }

            const range = new Range(position.with({character: startIndex + 1}), endPosition);

            return new Promise((res, _) => {
                const toc = buildToc(document);

                const headingCompletions: languages.CompletionItem[] = toc.reduce((prev: languages.CompletionItem[], curr: any) => {
                    let item = newCompletionItem('#' + slugify(curr.text), languages.CompletionItemKind.Reference);

                    if (addClosingParen) {
                        item.insertText = item.label + ')';
                    } else {
                        item.insertText = item.label
                    }

                    item.documentation = curr.text;
                    item.range = TypeConverters.Range.from(range);
                    prev.push(item);
                    return prev;
                }, []);

                res(completionList(headingCompletions));
            });
        } else {
            return completionList([]);
        }
    }
}
