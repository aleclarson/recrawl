import * as fs from 'fs';
export const localFs = {
    readdir: async (name) => fs.readdirSync(name),
    readlink: async (name) => fs.readlinkSync(name),
    lstat: async (name) => fs.lstatSync(name),
    stat: async (name) => fs.statSync(name),
};
