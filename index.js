
const process = require("process");
const fs = require("fs");
const bootstrap = fs.readFileSync("app/example_emscripten_opengl3.js");
const HappyDom = require("happy-dom");
const GL = require("gl");
const PNG = require("pngjs").PNG;

const wnd = new HappyDom.Window();

function sleep(ms){
    return new Promise((res) => setTimeout(res, ms));
}

let g_ctx = null;
const pixels0 = new Uint8Array(1920 * 1080 * 4);
const pixels1 = new Uint8Array(1920 * 1080 * 4);
let flip_fb = 0;
let shots = 0;

function update_screenshot(){
    let pixels = false;
    if(flip_fb == 0){
        pixels = pixels0;
        flip_fb = 1;
    }else{
        pixels = pixels1;
        flip_fb = 0;
    }
    //console.log("Pre", g_ctx.getError());
    g_ctx.readPixels(0, 0, 1280, 720, g_ctx.RGBA, g_ctx.UNSIGNED_BYTE, pixels);
    //console.log("Post", g_ctx.getError());
    shots++;

    //console.log("Shot", shots);
    let pngout = PNG.sync.write({width: 1280, height: 720, data: pixels});
    fs.writeFileSync("out" + shots.toString() + ".png", pngout);
    console.log("Save", shots);
}

// FakeFetch

function fake_fetch(path, opts) {
    console.log("Fake fetch", path, opts);
    if(path == "example_emscripten_opengl3.wasm"){
        return new Promise(ret => {
            ret({
                ok: true,
                arrayBuffer: function(){
                    let bin = fs.readFileSync("app/example_emscripten_opengl3.wasm");
                    console.log(bin);
                    return new Promise(res => {
                        res(bin);
                    });
                }
            });
        });
    }else{
        return null;
    }
}

// Emscripten patches

const my_canvas = {
    style: {
        cursor: "bogus"
    },
    getBoundingClientRect: function(){
        return {
            top: 0,
            bottom: 720,
            left: 0,
            right: 1280,
            x: 0,
            y: 0,
            width: 1280,
            height: 720
        };
    },
    addEventListener: function(typ, lis, usecapture){
        console.log("Add Event Listender", typ, lis, usecapture);
    },
    getContext: function(type,attr){
        console.log("Draw context", type, attr);
        if(type == "webgl"){
            g_ctx = GL(1280,720,attr);
            return g_ctx;
        }
        return null;
    }

};

const my_module = {
    locateFile: function (path, scriptDirectory) {
        return path;
    },
    canvas: my_canvas
};

const my_screen = {
    width: 1280,
    height: 720
};


wnd.navigator.getGamepads = function(){
    console.log("GetGamepads");
    return [];
}

wnd.requestAnimationFrame = function(cb){
    console.log("rAF");
    process.nextTick(async function(){
        await sleep(100);
        //const now = w.performance.now();
        const now = 0;
        console.log("RAF", now);
        cb(now);
        update_screenshot();
    });
    return 99.99;
}

function fake_settimeout(cb, ms){
    console.log("sTO", cb, ms);
    process.nextTick(async function(){
        await sleep(ms);
        //const now = w.performance.now();
        const now = 0;
        console.log("FRAME", now);
        cb();
        update_screenshot();
    });
}


// FakeDom

function fake_queryselector(tgt){
    console.log("querySelector", tgt);
    if(tgt == "#canvas"){
        return my_canvas;
    }else{
        return null;
    }
}

wnd.document.querySelector = fake_queryselector;

// Boot
const scr = wnd.document.createElement("script");

global.my_window = wnd;
global.my_fetch = fake_fetch;
global.my_doc = wnd.document;
global.my_module = my_module;
global.my_screen = my_screen;
global.fake_settimeout = fake_settimeout;

scr.textContent = "var window = global.my_window; var navigator = window.navigator; var fetch = global.my_fetch; var document = global.my_doc; var Module = global.my_module; var screen = global.my_screen; var setTimeout = global.fake_settimeout; \n" + bootstrap;
wnd.document.head.appendChild(scr);


