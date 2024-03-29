/**
 * Remove diacritics (accent and other marks) on characters, and dissociate double characters.
 * Based on the character map of http://lehelk.com/2011/05/06/script-to-remove-diacritics/
 * but per-character walk (improved performance).
 *
 * Licensed under WTFPL v2 http://sam.zoy.org/wtfpl/COPYING
 *
 * Modified by P. Douglas Reeder to map German and some Scandinavian letters to digraphs
 * (Ä -> Ae, and so forth) in the usual way, and to be a ES6 module.
 */
const diacritics = {
// Latin-1 Supplement
    "\u00AA": "a",   // FEMININE ORDINAL INDICATOR
    // "\u00B0": "degrees",
    "\u00B2": "2",   // SUPERSCRIPT TWO
    "\u00B3": "3",
    "\u00B5": "u",   // micro sign
    "\u00B9": "1",
    "\u00BA": "o",   // MASCULINE ORDINAL INDICATOR
    "\u00C0": "A",   // LATIN CAPITAL LETTER A WITH GRAVE
    "\u00C1": "A",
    "\u00C2": "A",
    "\u00C3": "A",
    "\u00C4": "A",   // LATIN CAPITAL LETTER A WITH DIAERESIS
    "\u00C5": "A",   // LATIN CAPITAL LETTER A WITH RING ABOVE
    "\u00C6": "Ae",   // LATIN CAPITAL LETTER AE
    "\u00C7": "C",
    "\u00C8": "E",
    "\u00C9": "E",
    "\u00CA": "E",
    "\u00CB": "E",
    "\u00CC": "I",
    "\u00CD": "I",
    "\u00CE": "I",
    "\u00CF": "I",
    "\u00D0": "Th",   // LATIN CAPITAL LETTER ETH
    "\u00D1": "N",   // LATIN CAPITAL LETTER N WITH TILDE
    "\u00D2": "O",
    "\u00D3": "O",
    "\u00D4": "O",
    "\u00D5": "O",
    "\u00D6": "O",   // LATIN CAPITAL LETTER O WITH DIAERESIS
    "\u00D8": "O",   // LATIN CAPITAL LETTER O WITH STROKE
    "\u00D9": "U",
    "\u00DA": "U",
    "\u00DB": "U",
    "\u00DC": "U",   // LATIN CAPITAL LETTER U WITH DIAERESIS
    "\u00DD": "Y",
    "\u00DE": "Th",   // LATIN CAPITAL LETTER THORN
    "\u00DF": "ss",   // ess-tset
    "\u00E0": "a",
    "\u00E1": "a",
    "\u00E2": "a",
    "\u00E3": "a",
    "\u00E4": "a",   // LATIN SMALL LETTER A WITH DIAERESIS
    "\u00E5": "a",   // LATIN SMALL LETTER A WITH RING ABOVE
    "\u00E6": "ae",   // LATIN SMALL LETTER AE
    "\u00E7": "c",
    "\u00E8": "e",
    "\u00E9": "e",
    "\u00EA": "e",
    "\u00EB": "e",
    "\u00EC": "i",
    "\u00ED": "i",
    "\u00EE": "i",
    "\u00EF": "i",
    "\u00F0": "th",
    "\u00F1": "n",   // LATIN SMALL LETTER N WITH TILDE
    "\u00F2": "o",
    "\u00F3": "o",
    "\u00F4": "o",
    "\u00F5": "o",
    "\u00F6": "o",   // LATIN SMALL LETTER O WITH DIAERESIS
    "\u00F8": "o",   // LATIN SMALL LETTER O WITH STROKE
    "\u00F9": "u",
    "\u00FA": "u",
    "\u00FB": "u",
    "\u00FC": "u",   // LATIN SMALL LETTER U WITH DIAERESIS
    "\u00FD": "y",
    "\u00FE": "th",   // LATIN SMALL LETTER THORN
    "\u00FF": "y",
// Latin Extended-A
    "\u0100": "A",
    "\u0101": "a",
    "\u0102": "A",
    "\u0103": "a",
    "\u0104": "A",
    "\u0105": "a",
    "\u0106": "C",
    "\u0107": "c",
    "\u0108": "C",
    "\u0109": "c",
    "\u010A": "C",
    "\u010B": "c",
    "\u010C": "C",
    "\u010D": "c",
    "\u010E": "D",
    "\u010F": "d",
    "\u0110": "D",
    "\u0111": "d",
    "\u0112": "E",
    "\u0113": "e",
    "\u0114": "E",
    "\u0115": "e",
    "\u0116": "E",
    "\u0117": "e",
    "\u0118": "E",
    "\u0119": "e",
    "\u011A": "E",
    "\u011B": "e",
    "\u011C": "G",
    "\u011D": "g",
    "\u011E": "G",
    "\u011F": "g",
    "\u0120": "G",
    "\u0121": "g",
    "\u0122": "G",
    "\u0123": "g",
    "\u0124": "H",
    "\u0125": "h",
    "\u0126": "H",
    "\u0127": "h",
    "\u0128": "I",
    "\u0129": "i",
    "\u012A": "I",
    "\u012B": "i",
    "\u012C": "I",
    "\u012D": "i",
    "\u012E": "I",
    "\u012F": "i",
    "\u0130": "I",
    "\u0131": "i",
    "\u0132": "IJ",   // LATIN CAPITAL LIGATURE IJ
    "\u0133": "ij",   // LATIN SMALL LIGATURE IJ
    "\u0134": "J",
    "\u0135": "j",
    "\u0136": "K",
    "\u0137": "k",
    "\u0138": "k",   // LATIN SMALL LETTER KRA
    "\u0139": "L",
    "\u013A": "l",
    "\u013B": "L",
    "\u013C": "l",
    "\u013D": "L",
    "\u013E": "l",
    "\u013F": "L",
    "\u0140": "l",
    "\u0141": "L",
    "\u0142": "l",
    "\u0143": "N",
    "\u0144": "n",
    "\u0145": "N",
    "\u0146": "n",
    "\u0147": "N",
    "\u0148": "n",
    "\u0149": "n",
    "\u014A": "Ng",   // LATIN CAPITAL LETTER ENG
    "\u014B": "ng",   // LATIN SMALL LETTER ENG
    "\u014C": "O",
    "\u014D": "o",
    "\u014E": "O",
    "\u014F": "o",
    "\u0150": "O",
    "\u0151": "o",
    "\u0152": "OE",
    "\u0153": "oe",
    "\u0154": "R",
    "\u0155": "r",
    "\u0156": "R",
    "\u0157": "r",
    "\u0158": "R",
    "\u0159": "r",
    "\u015A": "S",
    "\u015B": "s",
    "\u015C": "S",
    "\u015D": "s",
    "\u015E": "S",
    "\u015F": "s",
    "\u0160": "S",
    "\u0161": "s",
    "\u0162": "T",
    "\u0163": "t",
    "\u0164": "T",
    "\u0165": "t",
    "\u0166": "T",
    "\u0167": "t",
    "\u0168": "U",
    "\u0169": "u",
    "\u016A": "U",
    "\u016B": "u",
    "\u016C": "U",
    "\u016D": "u",
    "\u016E": "U",
    "\u016F": "u",
    "\u0170": "U",
    "\u0171": "u",
    "\u0172": "U",
    "\u0173": "u",
    "\u0174": "W",
    "\u0175": "w",
    "\u0176": "Y",
    "\u0177": "y",
    "\u0178": "Y",
    "\u0179": "Z",
    "\u017A": "z",
    "\u017B": "Z",
    "\u017C": "z",
    "\u017D": "Z",
    "\u017E": "z",
    "\u017F": "s",
// Latin Extended-B
    "\u0180": "b",
    "\u0181": "B",
    "\u0182": "B",
    "\u0183": "b",
    "\u0186": "O",
    "\u0187": "C",
    "\u0188": "c",
    "\u0189": "D",
    "\u018A": "D",
    "\u018B": "D",
    "\u018C": "d",
    "\u018E": "E",
    "\u0190": "E",
    "\u0191": "F",
    "\u0192": "f",
    "\u0193": "G",
    "\u0195": "hv",
    "\u0197": "I",
    "\u0198": "K",
    "\u0199": "k",
    "\u019A": "l",
    "\u019C": "M",
    "\u019D": "N",
    "\u019E": "n",
    "\u019F": "O",
    "\u01A0": "O",
    "\u01A1": "o",
    "\u01A2": "OI",
    "\u01A3": "oi",
    "\u01A4": "P",
    "\u01A5": "p",
    "\u01AC": "T",
    "\u01AD": "t",
    "\u01AE": "T",
    "\u01AF": "U",
    "\u01B0": "u",
    "\u01B2": "V",
    "\u01B3": "Y",
    "\u01B4": "y",
    "\u01B5": "Z",
    "\u01B6": "z",
    "\u01BF": "w",   // wynn
    "\u01C4": "DZ",
    "\u01C5": "Dz",
    "\u01C6": "dz",
    "\u01C7": "LJ",
    "\u01C8": "Lj",
    "\u01C9": "lj",
    "\u01CA": "NJ",
    "\u01CB": "Nj",
    "\u01CC": "nj",
    "\u01CD": "A",
    "\u01CE": "a",
    "\u01CF": "I",
    "\u01D0": "i",
    "\u01D1": "O",
    "\u01D2": "o",
    "\u01D3": "U",
    "\u01D4": "u",
    "\u01D5": "U",
    "\u01D6": "u",
    "\u01D7": "U",
    "\u01D8": "u",
    "\u01D9": "U",
    "\u01DA": "u",
    "\u01DB": "U",
    "\u01DC": "u",
    "\u01DD": "e",
    "\u01DE": "A",
    "\u01DF": "a",
    "\u01E0": "A",
    "\u01E1": "a",
    "\u01E2": "AE",
    "\u01E3": "ae",
    "\u01E4": "G",
    "\u01E5": "g",
    "\u01E6": "G",
    "\u01E7": "g",
    "\u01E8": "K",
    "\u01E9": "k",
    "\u01EA": "O",   // LATIN CAPITAL LETTER O WITH OGONEK
    "\u01EB": "o",   // LATIN SMALL LETTER O WITH OGONEK [visually similar to small capital Q]
    "\u01EC": "O",
    "\u01ED": "o",
    "\u01F0": "j",
    "\u01F1": "DZ",
    "\u01F2": "Dz",
    "\u01F3": "dz",
    "\u01F4": "G",
    "\u01F5": "g",
    "\u01F7": "W",   // capital wynn
    "\u01F8": "N",
    "\u01F9": "n",
    "\u01FA": "A",
    "\u01FB": "a",
    "\u01FC": "AE",
    "\u01FD": "ae",
    "\u01FE": "O",
    "\u01FF": "o",
    "\u0200": "A",
    "\u0201": "a",
    "\u0202": "A",
    "\u0203": "a",
    "\u0204": "E",
    "\u0205": "e",
    "\u0206": "E",
    "\u0207": "e",
    "\u0208": "I",
    "\u0209": "i",
    "\u020A": "I",
    "\u020B": "i",
    "\u020C": "O",
    "\u020D": "o",
    "\u020E": "O",
    "\u020F": "o",
    "\u0210": "R",
    "\u0211": "r",
    "\u0212": "R",
    "\u0213": "r",
    "\u0214": "U",
    "\u0215": "u",
    "\u0216": "U",
    "\u0217": "u",
    "\u0218": "S",
    "\u0219": "s",
    "\u021A": "T",
    "\u021B": "t",
    "\u021C": "Y",   // capital yogh
    "\u021D": "y",   // small yogh
    "\u021E": "H",
    "\u021F": "h",
    "\u0220": "N",
    "\u0222": "OU",
    "\u0223": "ou",
    "\u0224": "Z",
    "\u0225": "z",
    "\u0226": "A",
    "\u0227": "a",
    "\u0228": "E",
    "\u0229": "e",
    "\u022A": "O",
    "\u022B": "o",
    "\u022C": "O",
    "\u022D": "o",
    "\u022E": "O",
    "\u022F": "o",
    "\u0230": "O",
    "\u0231": "o",
    "\u0232": "Y",
    "\u0233": "y",
    "\u023A": "A",
    "\u023B": "C",
    "\u023C": "c",
    "\u023D": "L",
    "\u023E": "T",
    "\u023F": "s",
    "\u0240": "z",
    "\u0243": "B",
    "\u0244": "U",
    "\u0245": "V",
    "\u0247": "e",
    "\u0248": "J",
    "\u0249": "j",
    "\u024A": "Q",   // LATIN CAPITAL LETTER SMALL Q WITH HOOK TAIL
    "\u024B": "q",   // LATIN SMALL LETTER Q WITH HOOK TAIL
    "\u024C": "R",
    "\u024D": "r",
    "\u024E": "Y",
    "\u024F": "y",
    // Greek
    "\u037A": "ι",   // iota subscript
    "\u037F": "Ι",   // Yot [usually written as iota with a diacritic]

    "\u0386": "Α",   // Alpha w/ tonos
    "\u0388": "Ε",   // Epsilon w/ tonos
    "\u0389": "Η",   // Eta w/ tonos
    "\u038A": "Ι",   // Iota w/ tonos
    "\u038C": "Ο",   // Omicron w/ tonos
    "\u038E": "Υ",   // Upsilon w/ tonos
    "\u038F": "Ω",   // Omega w/ tonos
    "\u0390": "ι",   // iota w/ dialytika & tonos

    // "\u0391": "A",   // Alpha
    // "\u0392": "B",   // Beta
    // "\u0393": "G",   // Gamma
    // "\u0394": "D",   // Delta
    // "\u0395": "E",   // Epsilon
    // "\u0396": "Z",   // Zeta
    // "\u0397": "E",   // Eta
    // "\u0398": "Th",  // Theta
    // "\u0399": "I",   // Iota
    // "\u039A": "K",   // Kappa
    // "\u039B": "L",   // Lambda
    // "\u039C": "M",   // Mu
    // "\u039D": "N",   // Nu
    // "\u039E": "X",   // Xi
    // "\u039F": "O",   // Omicron
    // "\u03A0": "P",   // Pi
    // "\u03A1": "R",   // Rho
    // "\u03A3": "S",   // Sigma
    // "\u03A4": "T",   // Tau
    // "\u03A5": "Y",   // Upsilon
    // "\u03A6": "Ph",  // Phi
    // "\u03A7": "Ch",  // Chi
    // "\u03A8": "Ps",  // Psi
    // "\u03A9": "O",   // Omega

    "\u03AA": "Ι",   // Capital Iota with Dialytika
    "\u03AB": "Υ",   // Capital Upsilon with Dialytika

    "\u03AC": "α",   // small alpha w/ tonos
    "\u03AD": "ε",   // small epsilon w/ tonos
    "\u03AE": "η",   // small eta w/ tonos
    "\u03AF": "ι",   // small iota w/ tonos
    "\u03B0": "υ",   // small upsilon w/ dialytika & tonos

    // "\u03B1": "a",   // alpha
    // "\u03B2": "b",   // beta
    // "\u03B3": "g",   // gamma
    // "\u03B4": "d",   // delta
    // "\u03B5": "e",   // epsilon
    // "\u03B6": "z",   // zeta
    // "\u03B7": "e",   // eta
    // "\u03B8": "th",  // theta
    // "\u03B9": "i",   // iota
    // "\u03BA": "k",   // kappa
    // "\u03BB": "l",   // lambda
    // "\u03BC": "m",   // mu
    // "\u03BD": "n",   // nu
    // "\u03BE": "x",   // xi
    // "\u03BF": "o",   // omicron
    // "\u03C0": "p",   // pi
    // "\u03C1": "r",   // rho
    "\u03C2": "σ",   // sigma (final)
    // "\u03C3": "s",   // sigma
    // "\u03C4": "t",   // tau
    // "\u03C5": "y",   // upsilon
    // "\u03C6": "ph",  // phi
    // "\u03C7": "ch",  // chi
    // "\u03C8": "ps",  // psi
    // "\u03C9": "o",   // omega

    "\u03CA": "ι",   // iota w/ dialytika
    "\u03CB": "υ",   // upsilon w/ dialytika
    "\u03CC": "ο",   // omicron w/ tonos
    "\u03CD": "υ",   // upsilon w/ tonos
    "\u03CE": "ω",   // omega w/ tonos

    "\u03D0": "β",   // curled beta
    "\u03D1": "θ",   // script theta
    "\u03D2": "υ",   // Upsilon with hook
    "\u03D3": "υ",   // UPSILON WITH ACUTE AND HOOK
    "\u03D4": "υ",   // UPSILON WITH DIAERESIS AND HOOK
    "\u03D5": "φ",   // phi symbol
    "\u03D6": "π",   // pi looking like omega
    "\u03DA": "ΣΤ",  // Stigma
    "\u03DB": "στ",  // stigma
    "\u03E0": "ΣΣ",  // Sampi
    "\u03E1": "σσ",  // sampi

    "\u03F3": "ι",   // yot  [usually written as iota with a diacritic]
// IPA Extensions
//     "\u0250": "a",   // LATIN SMALL LETTER TURNED A
//     "\u0253": "b",
//     "\u0254": "o",
//     "\u0256": "d",
//     "\u0257": "d",
//     "\u025B": "e",
//     "\u0260": "g",
//     "\u0262": "G",   // LATIN LETTER SMALL CAPITAL G
//     "\u0265": "h",
//     "\u0268": "i",
//     "\u026A": "I",   // LATIN LETTER SMALL CAPITAL I
//     "\u026B": "l",
//     "\u026F": "m",
//     "\u0271": "m",
//     "\u0272": "n",
//     "\u0274": "N",   // LATIN LETTER SMALL CAPITAL N
//     "\u0275": "o",
//     "\u0276": "oe",
//     "\u027D": "r",
//     "\u0280": "R",   // LATIN LETTER SMALL CAPITAL R
//     "\u0288": "t",
//     "\u0289": "u",
//     "\u028B": "v",
//     "\u028C": "v",
//     "\u028F": "Y",   // LATIN LETTER SMALL CAPITAL Y
//     "\u0299": "B",   // LATIN LETTER SMALL CAPITAL B
//     "\u029C": "H",   // LATIN LETTER SMALL CAPITAL H
//     "\u029F": "L",   // LATIN LETTER SMALL CAPITAL L
    // Letter, Modifier
    "\u02BC": "'",   // MODIFIER LETTER APOSTROPHE
    // Phonetic Extensions
    // "\u1D00": "A",   // LATIN LETTER SMALL CAPITAL A
    // "\u1D04": "C",
    // "\u1D05": "D",
    // "\u1D07": "E",
    // "\u1D0A": "J",
    // "\u1D0B": "K",
    // "\u1D0D": "M",
    // "\u1D0F": "O",
    // "\u1D18": "P",
    // "\u1D1B": "T",
    // "\u1D1C": "U",
    // "\u1D20": "V",
    // "\u1D21": "W",
    // "\u1D22": "Z",
    // "\u1D79": "g",   // LATIN SMALL LETTER INSULAR G
    // "\u1D7D": "p",
// Latin Extended Additional
    "\u1E00": "A",   // LATIN CAPITAL LETTER A WITH RING BELOW
    "\u1E01": "a",
    "\u1E02": "B",
    "\u1E03": "b",
    "\u1E04": "B",
    "\u1E05": "b",
    "\u1E06": "B",
    "\u1E07": "b",
    "\u1E08": "C",
    "\u1E09": "c",
    "\u1E0A": "D",
    "\u1E0B": "d",
    "\u1E0C": "D",
    "\u1E0D": "d",
    "\u1E0E": "D",
    "\u1E0F": "d",
    "\u1E10": "D",
    "\u1E11": "d",
    "\u1E12": "D",
    "\u1E13": "d",
    "\u1E14": "E",
    "\u1E15": "e",
    "\u1E16": "E",
    "\u1E17": "e",
    "\u1E18": "E",
    "\u1E19": "e",
    "\u1E1A": "E",
    "\u1E1B": "e",
    "\u1E1C": "E",
    "\u1E1D": "e",
    "\u1E1E": "F",
    "\u1E1F": "f",
    "\u1E20": "G",
    "\u1E21": "g",
    "\u1E22": "H",
    "\u1E23": "h",
    "\u1E24": "H",
    "\u1E25": "h",
    "\u1E26": "H",
    "\u1E27": "h",
    "\u1E28": "H",
    "\u1E29": "h",
    "\u1E2A": "H",
    "\u1E2B": "h",
    "\u1E2C": "I",
    "\u1E2D": "i",
    "\u1E2E": "I",
    "\u1E2F": "i",
    "\u1E30": "K",
    "\u1E31": "k",
    "\u1E32": "K",
    "\u1E33": "k",
    "\u1E34": "K",
    "\u1E35": "k",
    "\u1E36": "L",
    "\u1E37": "l",
    "\u1E38": "L",
    "\u1E39": "l",
    "\u1E3A": "L",
    "\u1E3B": "l",
    "\u1E3C": "L",
    "\u1E3D": "l",
    "\u1E3E": "M",
    "\u1E3F": "m",
    "\u1E40": "M",
    "\u1E41": "m",
    "\u1E42": "M",
    "\u1E43": "m",
    "\u1E44": "N",
    "\u1E45": "n",
    "\u1E46": "N",
    "\u1E47": "n",
    "\u1E48": "N",
    "\u1E49": "n",
    "\u1E4A": "N",
    "\u1E4B": "n",
    "\u1E4C": "O",
    "\u1E4D": "o",
    "\u1E4E": "O",
    "\u1E4F": "o",
    "\u1E50": "O",
    "\u1E51": "o",
    "\u1E52": "O",
    "\u1E53": "o",
    "\u1E54": "P",
    "\u1E55": "p",
    "\u1E56": "P",
    "\u1E57": "p",
    "\u1E58": "R",
    "\u1E59": "r",
    "\u1E5A": "R",
    "\u1E5B": "r",
    "\u1E5C": "R",
    "\u1E5D": "r",
    "\u1E5E": "R",
    "\u1E5F": "r",
    "\u1E60": "S",
    "\u1E61": "s",
    "\u1E62": "S",
    "\u1E63": "s",
    "\u1E64": "S",
    "\u1E65": "s",
    "\u1E66": "S",
    "\u1E67": "s",
    "\u1E68": "S",
    "\u1E69": "s",
    "\u1E6A": "T",
    "\u1E6B": "t",
    "\u1E6C": "T",
    "\u1E6D": "t",
    "\u1E6E": "T",
    "\u1E6F": "t",
    "\u1E70": "T",
    "\u1E71": "t",
    "\u1E72": "U",
    "\u1E73": "u",
    "\u1E74": "U",
    "\u1E75": "u",
    "\u1E76": "U",
    "\u1E77": "u",
    "\u1E78": "U",
    "\u1E79": "u",
    "\u1E7A": "U",
    "\u1E7B": "u",
    "\u1E7C": "V",
    "\u1E7D": "v",
    "\u1E7E": "V",
    "\u1E7F": "v",
    "\u1E80": "W",
    "\u1E81": "w",
    "\u1E82": "W",
    "\u1E83": "w",
    "\u1E84": "W",
    "\u1E85": "w",
    "\u1E86": "W",
    "\u1E87": "w",
    "\u1E88": "W",
    "\u1E89": "w",
    "\u1E8A": "X",
    "\u1E8B": "x",
    "\u1E8C": "X",
    "\u1E8D": "x",
    "\u1E8E": "Y",
    "\u1E8F": "y",
    "\u1E90": "Z",
    "\u1E91": "z",
    "\u1E92": "Z",
    "\u1E93": "z",
    "\u1E94": "Z",
    "\u1E95": "z",
    "\u1E96": "h",
    "\u1E97": "t",
    "\u1E98": "w",
    "\u1E99": "y",
    "\u1E9A": "a",
    "\u1E9B": "s",
    "\u1E9E": "SS",   // ess-tsett
    "\u1EA0": "A",
    "\u1EA1": "a",
    "\u1EA2": "A",
    "\u1EA3": "a",
    "\u1EA4": "A",
    "\u1EA5": "a",
    "\u1EA6": "A",
    "\u1EA7": "a",
    "\u1EA8": "A",
    "\u1EA9": "a",
    "\u1EAA": "A",
    "\u1EAB": "a",
    "\u1EAC": "A",
    "\u1EAD": "a",
    "\u1EAE": "A",
    "\u1EAF": "a",
    "\u1EB0": "A",
    "\u1EB1": "a",
    "\u1EB2": "A",
    "\u1EB3": "a",
    "\u1EB4": "A",
    "\u1EB5": "a",
    "\u1EB6": "A",
    "\u1EB7": "a",
    "\u1EB8": "E",
    "\u1EB9": "e",
    "\u1EBA": "E",
    "\u1EBB": "e",
    "\u1EBC": "E",
    "\u1EBD": "e",
    "\u1EBE": "E",
    "\u1EBF": "e",
    "\u1EC0": "E",
    "\u1EC1": "e",
    "\u1EC2": "E",
    "\u1EC3": "e",
    "\u1EC4": "E",
    "\u1EC5": "e",
    "\u1EC6": "E",
    "\u1EC7": "e",
    "\u1EC8": "I",
    "\u1EC9": "i",
    "\u1ECA": "I",
    "\u1ECB": "i",
    "\u1ECC": "O",
    "\u1ECD": "o",
    "\u1ECE": "O",
    "\u1ECF": "o",
    "\u1ED0": "O",
    "\u1ED1": "o",
    "\u1ED2": "O",
    "\u1ED3": "o",
    "\u1ED4": "O",
    "\u1ED5": "o",
    "\u1ED6": "O",
    "\u1ED7": "o",
    "\u1ED8": "O",
    "\u1ED9": "o",
    "\u1EDA": "O",
    "\u1EDB": "o",
    "\u1EDC": "O",
    "\u1EDD": "o",
    "\u1EDE": "O",
    "\u1EDF": "o",
    "\u1EE0": "O",
    "\u1EE1": "o",
    "\u1EE2": "O",
    "\u1EE3": "o",
    "\u1EE4": "U",
    "\u1EE5": "u",
    "\u1EE6": "U",
    "\u1EE7": "u",
    "\u1EE8": "U",
    "\u1EE9": "u",
    "\u1EEA": "U",
    "\u1EEB": "u",
    "\u1EEC": "U",
    "\u1EED": "u",
    "\u1EEE": "U",
    "\u1EEF": "u",
    "\u1EF0": "U",
    "\u1EF1": "u",
    "\u1EF2": "Y",
    "\u1EF3": "y",
    "\u1EF4": "Y",
    "\u1EF5": "y",
    "\u1EF6": "Y",
    "\u1EF7": "y",
    "\u1EF8": "Y",
    "\u1EF9": "y",
    "\u1EFE": "Y",
    "\u1EFF": "y",
    // Greek Extended (for Ancient Greek)
    // TODO: all those accented letters!
    "\u1F00": "α",
    "\u1F01": "α",
    "\u1F02": "α",
    "\u1F03": "α",
    "\u1F04": "α",
    "\u1F05": "α",
    "\u1F06": "α",
    "\u1F07": "α",
    "\u1F08": "Α",   // Alpha with psili
    "\u1F09": "Α",   // Alpha with
    "\u1F0A": "Α",   // Alpha with
    "\u1F0B": "Α",   // Alpha with
    "\u1F0C": "Α",   // Alpha with
    "\u1F0D": "Α",   // Alpha with
    "\u1F0E": "Α",   // Alpha with
    "\u1F0F": "Α",   // Alpha with
    "\u1F10": "ε",   // epsilon with psili
    "\u1F11": "ε",   // epsilon with
    "\u1F12": "ε",   // epsilon with
    "\u1F13": "ε",   // epsilon with
    "\u1F14": "ε",   // epsilon with
    "\u1F15": "ε",   // epsilon with
    "\u1F18": "Ε",   // Epsilon with
    "\u1F19": "Ε",   // Epsilon with
    "\u1F1A": "Ε",   // Epsilon with
    "\u1F1B": "Ε",   // Epsilon with
    "\u1F1C": "Ε",   // Epsilon with
    "\u1F1D": "Ε",   // Epsilon with
    "\u1F20": "η",   // eta with
    "\u1F21": "η",   // eta with
    "\u1F22": "η",   // eta with
    "\u1F23": "η",   // eta with
    "\u1F24": "η",   // eta with
    "\u1F25": "η",   // eta with
    "\u1F26": "η",   // eta with
    "\u1F27": "η",   // eta with
    "\u1F28": "Η",   // Eta with
    "\u1F29": "Η",   // Eta with
    "\u1F2A": "Η",   // Eta with
    "\u1F2B": "Η",   // Eta with
    "\u1F2C": "Η",   // Eta with
    "\u1F2D": "Η",   // Eta with
    "\u1F2E": "Η",   // Eta with
    "\u1F2F": "Η",   // Eta with
    "\u1F30": "ι",   // iota with
    "\u1F31": "ι",   // iota with
    "\u1F32": "ι",   // iota with
    "\u1F33": "ι",   // iota with
    "\u1F34": "ι",   // iota with
    "\u1F35": "ι",   // iota with
    "\u1F36": "ι",   // iota with psili & perispomeni
    "\u1F37": "ι",   // iota with
    "\u1F38": "Ι",   // iota w/ psili
    "\u1F4C": "ο",   // omicron with psili & oxia
    "\u1F66": "ω",   // omega with psili & perispomeni
    "\u1FBA": "Α",   // Alpha with varia
    "\u1FD6": "ι",   //  IOTA WITH PERISPOMENI
    "\u1F70": "α",
    "\u1F78": "ο",   //  OMICRON WITH VARIA
    // General Punctuation
    "\u2019": "'",   // RIGHT SINGLE QUOTATION MARK
    // Superscripts and Subscripts
    "\u2070": "0",   // SUPERSCRIPT ZERO
    "\u2071": "i",   // SUPERSCRIPT LATIN SMALL LETTER I
    "\u2074": "4",
    "\u2075": "5",
    "\u2076": "6",
    "\u2077": "7",
    "\u2078": "8",
    "\u2079": "9",
    "\u207F": "n",   // SUPERSCRIPT LATIN SMALL LETTER N
    "\u2080": "0",
    "\u2081": "1",
    "\u2082": "2",
    "\u2083": "3",
    "\u2084": "4",
    "\u2085": "5",
    "\u2086": "6",
    "\u2087": "7",
    "\u2088": "8",
    "\u2089": "9",
    "\u2090": "a",   // LATIN SUBSCRIPT SMALL LETTER A
    "\u2091": "e",   // LATIN SUBSCRIPT SMALL LETTER E
    "\u2092": "o",   // LATIN SUBSCRIPT SMALL LETTER o
    "\u2093": "x",   // LATIN SUBSCRIPT SMALL LETTER X
    // Letterlike Symbols
    // "\u2114": "LB",   // L B BAR SYMBOL
    // "\u2116": "Number",
    "\u211E": "Rx",
    // "\u2121": "Telephone",
    // "\u2125": "oz",
    // "\u2126": "Ohms",   // Ohm sign (omega)
    "\u212B": "A",   // Ångström
    // "\u213B": "Fax",
    // Number Forms
    "\u2184": "c",   // LATIN SMALL LETTER REVERSED C (Claudian)
    // Enclosed Alphanumerics
    "\u2460": "1",
    "\u2461": "2",
    "\u2462": "3",
    "\u2463": "4",
    "\u2464": "5",
    "\u2465": "6",
    "\u2466": "7",
    "\u2467": "8",
    "\u2468": "9",
    "\u2469": "10",
    "\u246A": "11",
    "\u246B": "12",
    "\u246C": "13",
    "\u246D": "14",
    "\u246E": "15",
    "\u246F": "16",
    "\u2470": "17",
    "\u2471": "18",
    "\u2472": "19",
    "\u2473": "20",
    "\u2474": "1",
    "\u2475": "2",
    "\u2476": "3",
    "\u2477": "4",
    "\u2478": "5",
    "\u2479": "6",
    "\u247A": "7",
    "\u247B": "8",
    "\u247C": "9",
    "\u247D": "10",
    "\u247E": "11",
    "\u247F": "12",
    "\u2480": "13",
    "\u2481": "14",
    "\u2482": "15",
    "\u2483": "16",
    "\u2484": "17",
    "\u2485": "18",
    "\u2486": "19",
    "\u2487": "20",
    "\u2488": "1",
    "\u2489": "2",
    "\u248A": "3",
    "\u248B": "4",
    "\u248C": "5",
    "\u248D": "6",
    "\u248E": "7",
    "\u248F": "8",
    "\u2490": "9",
    "\u24B6": "A",   // CIRCLED LATIN CAPITAL LETTER A
    "\u24B7": "B",
    "\u24B8": "C",
    "\u24B9": "D",
    "\u24BA": "E",
    "\u24BB": "F",
    "\u24BC": "G",
    "\u24BD": "H",
    "\u24BE": "I",
    "\u24BF": "J",
    "\u24C0": "K",
    "\u24C1": "L",
    "\u24C2": "M",
    "\u24C3": "N",
    "\u24C4": "O",
    "\u24C5": "P",
    "\u24C6": "Q",
    "\u24C7": "R",
    "\u24C8": "S",
    "\u24C9": "T",
    "\u24CA": "U",
    "\u24CB": "V",
    "\u24CC": "W",
    "\u24CD": "X",
    "\u24CE": "Y",
    "\u24CF": "Z",
    "\u24D0": "a",
    "\u24D1": "b",
    "\u24D2": "c",
    "\u24D3": "d",
    "\u24D4": "e",
    "\u24D5": "f",
    "\u24D6": "g",
    "\u24D7": "h",
    "\u24D8": "i",
    "\u24D9": "j",
    "\u24DA": "k",
    "\u24DB": "l",
    "\u24DC": "m",
    "\u24DD": "n",
    "\u24DE": "o",
    "\u24DF": "p",
    "\u24E0": "q",
    "\u24E1": "r",
    "\u24E2": "s",
    "\u24E3": "t",
    "\u24E4": "u",
    "\u24E5": "v",
    "\u24E6": "w",
    "\u24E7": "x",
    "\u24E8": "y",
    "\u24E9": "z",
    "\u24EA": "0",
    "\u24F5": "1",
    "\u24F6": "2",
    "\u24F7": "3",
    "\u24F8": "4",
    "\u24F9": "5",
    "\u24FA": "6",
    "\u24FB": "7",
    "\u24FC": "8",
    "\u24FD": "9",
// Dingbats
    "\u2776": "1",   // DINGBAT NEGATIVE CIRCLED DIGIT ONE
    "\u2777": "2",
    "\u2778": "3",
    "\u2779": "4",
    "\u277A": "5",
    "\u277B": "6",
    "\u277C": "7",
    "\u277D": "8",
    "\u277E": "9",
// Latin Extended-C
    "\u2C60": "L",
    "\u2C61": "l",
    "\u2C62": "L",
    "\u2C63": "P",
    "\u2C64": "R",
    "\u2C65": "a",
    "\u2C66": "t",
    "\u2C67": "H",
    "\u2C68": "h",
    "\u2C69": "K",
    "\u2C6A": "k",
    "\u2C6B": "Z",
    "\u2C6C": "z",
    "\u2C6E": "M",
    "\u2C6F": "A",
    "\u2C72": "W",
    "\u2C73": "w",
    "\u2C75": "H",
    "\u2C76": "h",
    "\u2C7E": "S",
    "\u2C7F": "Z",
// Latin Extended-D
    "\uA728": "TZ",
    "\uA729": "tz",
    "\uA730": "F",   // LATIN LETTER SMALL CAPITAL F
    "\uA731": "S",   // LATIN LETTER SMALL CAPITAL S
    "\uA732": "AA",
    "\uA733": "aa",
    "\uA734": "AO",
    "\uA735": "ao",
    "\uA736": "AU",
    "\uA737": "au",
    "\uA738": "AV",
    "\uA739": "av",
    "\uA73A": "AV",
    "\uA73B": "av",
    "\uA73C": "AY",
    "\uA73D": "ay",
    "\uA73E": "C",
    "\uA73F": "c",
    "\uA740": "K",
    "\uA741": "k",
    "\uA742": "K",
    "\uA743": "k",
    "\uA744": "K",
    "\uA745": "k",
    "\uA746": "L",
    "\uA747": "l",
    "\uA748": "L",
    "\uA749": "l",
    "\uA74A": "O",
    "\uA74B": "o",
    "\uA74C": "O",
    "\uA74D": "o",
    "\uA74E": "OO",
    "\uA74F": "oo",
    "\uA750": "P",
    "\uA751": "p",
    "\uA752": "P",
    "\uA753": "p",
    "\uA754": "P",
    "\uA755": "p",
    "\uA756": "Q",
    "\uA757": "q",
    "\uA758": "Q",
    "\uA759": "q",
    "\uA75A": "R",
    "\uA75B": "r",
    "\uA75E": "V",
    "\uA75F": "v",
    "\uA760": "VY",
    "\uA761": "vy",
    "\uA762": "Z",
    "\uA763": "z",
    "\uA779": "D",
    "\uA77A": "d",
    "\uA77B": "F",
    "\uA77C": "f",
    "\uA77D": "G",
    "\uA77E": "G",
    "\uA77F": "g",
    "\uA780": "L",
    "\uA781": "l",
    "\uA782": "R",
    "\uA783": "r",
    "\uA784": "S",
    "\uA785": "s",
    "\uA786": "T",
    "\uA787": "t",
    "\uA78D": "H",
    "\uA790": "N",
    "\uA791": "n",
    "\uA7A0": "G",
    "\uA7A1": "g",
    "\uA7A2": "K",
    "\uA7A3": "k",
    "\uA7A4": "N",
    "\uA7A5": "n",
    "\uA7A6": "R",
    "\uA7A7": "r",
    "\uA7A8": "S",
    "\uA7A9": "s",
    "\uA7AF": "Q",   // LATIN LETTER SMALL CAPITAL Q
// Half-width and Full-width Forms
    "\uFF10": "0",
    "\uFF11": "1",
    "\uFF12": "2",
    "\uFF13": "3",
    "\uFF14": "4",
    "\uFF15": "5",
    "\uFF16": "6",
    "\uFF17": "7",
    "\uFF18": "8",
    "\uFF19": "9",
    "\uFF21": "A",   // FULLWIDTH LATIN CAPITAL LETTER A
    "\uFF22": "B",
    "\uFF23": "C",
    "\uFF24": "D",
    "\uFF25": "E",
    "\uFF26": "F",
    "\uFF27": "G",
    "\uFF28": "H",
    "\uFF29": "I",
    "\uFF2A": "J",
    "\uFF2B": "K",
    "\uFF2C": "L",
    "\uFF2D": "M",
    "\uFF2E": "N",
    "\uFF2F": "O",
    "\uFF30": "P",
    "\uFF31": "Q",
    "\uFF32": "R",
    "\uFF33": "S",
    "\uFF34": "T",
    "\uFF35": "U",
    "\uFF36": "V",
    "\uFF37": "W",
    "\uFF38": "X",
    "\uFF39": "Y",
    "\uFF3A": "Z",
    "\uFF41": "a",
    "\uFF42": "b",
    "\uFF43": "c",
    "\uFF44": "d",
    "\uFF45": "e",
    "\uFF46": "f",
    "\uFF47": "g",
    "\uFF48": "h",
    "\uFF49": "i",
    "\uFF4A": "j",
    "\uFF4B": "k",
    "\uFF4C": "l",
    "\uFF4D": "m",
    "\uFF4E": "n",
    "\uFF4F": "o",
    "\uFF50": "p",
    "\uFF51": "q",
    "\uFF52": "r",
    "\uFF53": "s",
    "\uFF54": "t",
    "\uFF55": "u",
    "\uFF56": "v",
    "\uFF57": "w",
    "\uFF58": "x",
    "\uFF59": "y",
    "\uFF5A": "z"
};
switch ((navigator.language || navigator.userLanguage).slice(0, 2).toLowerCase()) {
    case 'de':   // German
        diacritics["\u00C4"] = "Ae";   // LATIN CAPITAL LETTER A WITH DIAERESIS
        diacritics["\u00E4"] = "ae";   // LATIN SMALL LETTER A WITH DIAERESIS
        diacritics["\u00D6"] = "Oe";   // LATIN CAPITAL LETTER O WITH DIAERESIS
        diacritics["\u00F6"] = "oe";   // LATIN SMALL LETTER O WITH DIAERESIS
        diacritics["\u00DC"] = "Ue";   // LATIN CAPITAL LETTER U WITH DIAERESIS
        diacritics["\u00FC"] = "ue";   // LATIN SMALL LETTER U WITH DIAERESIS
        break;
    case 'es':   // Spanish
        delete diacritics["\u00D1"];   // Ñ is a different letter than N in Spanish
        delete diacritics["\u00F1"];   // ñ is a different letter than n in Spanish
        break;
    default:
}

function removeDiacritics(str) {
    const chars = str.split('');
    let i = chars.length - 1, altered = false, ch;
    for (; i >= 0; i--) {
        ch = chars[i];
        if (Object.hasOwn(diacritics, ch)) {
            chars[i] = diacritics[ch];
            altered = true;
        }
    }
    if (altered) {
        str = chars.join('');
    }
    return str;
}

export default removeDiacritics;
