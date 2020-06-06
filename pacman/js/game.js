var score = 0;
var gscore = 0;
var ghost = false;
var player = {
    x: 50,
    y: 100,
    pacmouth: 320,
    pacdir: 0,
    pacsize: 32,
    speed: 5,
};

var enemy = {
    x: 0,
    y: 0,
    speed: 5,
    moving: 0,
    eyedir: 0,
    dirx: 0,
    diry: 0,
    ghostNum: 64 
};

function num(n) {
    return Math.floor(Math.random() * n);
}

var canvas = document.createElement("canvas");
var context = canvas.getContext("2d");
// set height and width
canvas.height = 400;
canvas.width = 600;
// load pakaman.png
var mainImage = new Image();
mainImage.ready = false;
mainImage.onload = checkReady;
mainImage.src = "packman.png";


// append to document
document.getElementById("container").append(canvas);

function checkReady() {
    this.ready = true;
    playgame();
}

function playgame() {
    render();
    requestAnimationFrame(playgame);
}

function render() {
    // fill canvas with background
    context.fillStyle = "pink";
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    if(!ghost) {
        enemy.ghostNum = num(5) * 64;
        enemy.x = num(450);
        enemy.y = num(200);
        ghost = true
    }
    
    if (player.moving) {
        if (player.x >= (canvas.width - player.pacsize)) {
            player.x = 0;
        }
        if (player.y >= (canvas.height - player.pacsize)) {
            player.y = 0;
        }
        if (player.x < 0) {
            player.x = canvas.width - player.pacsize;
        }
        if (player.y < 0) {
            player.y = canvas.height - player.pacsize;
        }
    
        player.x += player.dirx;
        player.y += player.diry;
        
    }
    
    if(enemy.moving < 0) {
        enemy.moving = (num(15)*3)+10+num(2);
        //enemy.speed = num(5);
        enemy.dirx = 0;
        enemy.diry =0;
        if(enemy.moving % 2) {
            if (player.x < enemy.x) {
                enemy.dirx = -enemy.speed;
                enemy.eyedir = 64;
            } else {
                enemy.dirx = enemy.speed;
                enemy.eyedir = 0;
            }
        } else {
            if (player.y < enemy.y) {
                enemy.diry = -enemy.speed;
                enemy.eyedir = 96;
            } else {
                enemy.diry = enemy.speed;
                enemy.eyedir = 32;
            }
        }
    }
    
    enemy.x += enemy.dirx;
    enemy.y += enemy.diry;
    enemy.moving--;

    if (enemy.x >= (canvas.width - player.pacsize)) {
        enemy.x = 0;
    }
    if (enemy.y >= (canvas.height - player.pacsize)) {
        enemy.y = 0;
    }
    if (enemy.x < 0) {
        enemy.x = canvas.width - player.pacsize;
    }
    if (enemy.y < 0) {
        enemy.y = canvas.height - player.pacsize;
    }
    if (enemy.moving % 8 == 0) {
        if (enemy.ghostNum % 64) {
            enemy.ghostNum -= 32;
        } else {
            enemy.ghostNum += 32;
        }
        if (player.moving == true) {
            if (player.pacmouth == 320) {
                player.pacmouth = 352;
            } else {
                player.pacmouth = 320;
            }
        }
    }
    
    // add text of player score
    context.font = "20px Verdana";
    context.fillStyle = "blue";
    context.fillText("Pacman: " + score + " vs Ghost: " + gscore, 2, 18);
    
    // draw player
    context.drawImage(mainImage, enemy.ghostNum, enemy.eyedir, 32, 32, enemy.x, enemy.y, player.pacsize, player.pacsize);
    context.drawImage(mainImage, player.pacmouth, player.pacdir, 32, 32, player.x, player.y, player.pacsize, player.pacsize);
}

var keyclick = {};
document.addEventListener("keydown", function (event) {
    keyclick[event.keyCode] = true;
    move(keyclick);
}, false);

document.addEventListener("keyup", function (event) {
    delete keyclick[event.keyCode];
}, false);

function move(keyclick) {
    if (37 in keyclick) {
        player.dirx = -player.speed;
        player.diry = 0;
        player.pacdir = 64;
        player.moving = true;
    } else if (38 in keyclick) {
        player.dirx = 0;
        player.diry = -player.speed;
        player.pacdir = 96;
        player.moving = true;
    } else if (39 in keyclick) {
        player.dirx = player.speed;
        player.diry = 0;
        player.pacdir = 0;
        player.moving = true;
    } else if (40 in keyclick) {
        player.dirx = 0;
        player.diry = player.speed;
        player.pacdir = 32;
        player.moving = true;
    }
}