/* Unit tests: document parser (pure, no browser needed). */
'use strict';
const { assert, assertEqual, summary } = require('../helpers/harness');

const parser = require('../../src/core/documentParser.js');

// English paragraphs and sentences
const en = parser.parseDocument('Hello world. How are you?\n\nSecond paragraph here! It works.');
assertEqual(en.sentences.length, 4, 'EN: sentence count');
assertEqual(en.paragraphStarts.length, 2, 'EN: paragraph count');
assertEqual(en.sentences[2].paragraph, 1, 'EN: paragraph index of third sentence');

// Tamil text with English punctuation
const ta = parser.parseDocument('வணக்கம். நீங்கள் எப்படி இருக்கிறீர்கள்? நன்று.');
assertEqual(ta.sentences.length, 3, 'TA: sentence count');
assert(ta.sentences[0].text.startsWith('வணக்கம்'), 'TA: first sentence intact');

// Indian danda punctuation (fallback path)
const danda = parser.parseDocument('यह एक वाक्य है। यह दूसरा वाक्य है।');
assert(danda.sentences.length >= 2, 'Danda: sentences split on ।');

// Unterminated paragraph becomes one sentence
const single = parser.parseDocument('just one line without punctuation');
assertEqual(single.sentences.length, 1, 'no-punct: single sentence');

// CRLF + soft line wraps join within a paragraph
const wraps = parser.parseDocument('Line one\r\nline two same para.\r\n\r\nNew para starts.');
assertEqual(wraps.sentences.length, 2, 'CRLF: two sentences');
assert(wraps.sentences[0].text.includes('Line one line two'), 'CRLF: soft wrap joined');

// Blank-line paragraph separation drives paragraphStarts correctly
const paras = parser.parseDocument('A1. A2.\n\nB1. B2. B3.\n\nC1.');
assertEqual(paras.paragraphStarts.length, 3, 'paragraphs: count');
assertEqual(paras.paragraphStarts[1], 2, 'paragraphs: second starts at sentence 2');
assertEqual(paras.paragraphStarts[2], 5, 'paragraphs: third starts at sentence 5');

// Empty input yields nothing, without throwing
const empty = parser.parseDocument('   \n\n ');
assertEqual(empty.sentences.length, 0, 'empty doc: no crash, 0 sentences');

summary('documentParser.test');
