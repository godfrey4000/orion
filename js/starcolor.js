/**
  * StarColor
  *
  * Manages a color scheme for stars.  It recognizes the spectral destinctions
  * M, K, G, F, A, B, O, in increasing temperature.
  */
var StarColor = function(colorMap) {

    var mapper = new Map(colorMap)
    this.colors = Array.from(mapper.values());
    return this;
};

StarColor.prototype.intFromSpectralClass = function(spectralClass) {

    switch (spectralClass) {
        case "M":
            return 0;
            break;
        case "K":
            return 1;
            break;
        case "G":
            return 2;
            break;
        case "F":
            return 3;
            break;
        case "A":
            return 4;
            break;
        case "B":
            return 5;
            break;
        case "O":
            return 6;
            break;
    }
};

StarColor.prototype.color = function(spectralClass) {
    
    var index = this.intFromSpectralClass(spectralClass);
    return this.colors[index];
};

/*
** Colors from Michael Charity.
**
** O     155 176 255  #9bb0ff
** B     170 191 255  #aabfff
** A     202 215 255  #cad7ff
** F     248 247 255  #f8f7ff
** G     255 244 234  #fff4ea
** K     255 210 161  #ffd2a1
** M     255 204 111  #ffcc6f
*/
const STARCOLORS_CHARITY = new StarColor([
    ['M', 0xffcc6f],
    ['K', 0xffd2a1],
    ['G', 0xfff4ea],
    ['F', 0xf8f7ff],
    ['A', 0xcad7ff],
    ['B', 0xaabfff],
    ['O', 0x9bb0ff]]);
    
/*
** Subjective star colors, resemling more closely what one sees "subjectively"
** in the night sky.
**
**    O 0xfafdff;
**    B 0xfafdff;
**    A 0xfaffff;
**    F 0xfafffa;
**    G 0xfffffa;
**    K 0xfffdfa;
**    M 0xfffafa;
*/
const STARCOLORS_SUBJECTIVE = new StarColor([
    ['M', 0xfffafa],
    ['K', 0xfffdfa],
    ['G', 0xfffffa],
    ['F', 0xfafffa],
    ['A', 0xfaffff],
    ['B', 0xfafdff],
    ['O', 0xfafdff]]);
