const { register, require: tsxRequire } = require("tsx/cjs/api");

register();
tsxRequire("./main.ts", __filename);
