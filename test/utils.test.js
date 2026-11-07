'use strict';
process.env.NEXO_FANCY_FONT = '0';   // les tests lisent le texte en lettres normales (la police monospace est testée à part)

const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluate } = require('../commands/utils');

test('calculatrice : priorités, puissances, fonctions', () => {
    assert.equal(evaluate('12*(3+4)'), 84);
    assert.equal(evaluate('2^3^2'), 512);
    assert.equal(evaluate('-2^2'), -4);
    assert.equal(evaluate('sqrt(144)+2^3'), 20);
    assert.equal(evaluate('2,5*2'), 5);
});

test('calculatrice : refuse tout ce qui n\'est pas un calcul', () => {
    for (const bad of ['1/0', '(1+2', 'process.exit()', 'require("fs")', '1+', 'abc']) {
        assert.throws(() => evaluate(bad), bad);
    }
});
