const fs = require("fs");
var c = fs.readFileSync("timp.ts", "utf-8");
var lines = c.split("\n");

# Line 45: add hard limit check after line 40
var new_lines = [];
for (var i = 0; i < lines.length; i++) {
  if (i == 40) {
    new_lines. push("    }");
    new_lines. push("  }");
    new_lines.push("");
    new_lines.push("  // 孌/明下孧劺努的亚事，仜成井劲努的亚事㚁孚的些劲努孧劺努劊的些劲劊的些劺的些劲夎孚劺恇扮劺孧劺努鋆莎苮舐审纆劺孓定努加总圪鋆莎苮�""����Wu�Ɩ�W2�W6��"�b���F�&6ScBbb��F�&6ScB��V�wF���S���"����Wu�Ɩ�W2�W6��"6��6��R�v&��F�W#��Ǘ�U���F�&6ScBF���&vR�G���F�&6ScB��V�wF��6�'2��f�&6��r&W6��RF�#G���"����Wu�Ɩ�W2�W6��"��F�&6ScB�v�B&W6��T&6ScD�VVFVB���F�&6ScB�#B��"����Wu�Ɩ�W2�W6��"6��6��R���r��F�W#��Ǘ�U�gFW"f�&6VB&W6��S�G���F�&6ScB��V�wF��6�'6���"����Wu�Ɩ�W2�W6��"�"����V�6R���Wu�Ɩ�W2�W6��Ɩ�W5��ғ��ЧЧf"�Wu�6��FV�B��Wu�Ɩ�W2����%��"����2f��W'&�"��rƖ�P��Wu�6��FV�B��Wu�6��FV�B�&W�6R��v6��6��R�W'&�"�%�F�W#��Ǘ�U�F6�66�Rf�6���W'&�""�&W7�7FGW2��r��v6��6��R�W'&�"�%�F�W#��Ǘ�U�F6�66�Rf�6���W'&�""�&W7�7FGW2������F�&6ScB�V�wF��G���F�&6ScB���F�&6ScB��V�wF����7FGW3�G�&W7�7FGW7Җ��p�����&��B�$f��W2ƖVB"��