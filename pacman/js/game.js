var document = window.document;

/**
 * Utility functions
 */
function num(n) {
    return Math.floor(Math.random() * n);
}

/**
 * Control Panel - start/pause game, control keys for pacman, etc. 
 */
var ControlPanel = {
    pause: true,
    isPaused : function () {
        return this.pause;
    },
    paussed: function() {
        this.pause = true;
    },
    play: function() {
        this.pause = false;
    }
};

/**
 * Player
 */
var Player = {
    x: num(200),
    y: num(300),
    pacmouth: 320,
    pacdir: 0,
    pacsize: 32,
    speed: 3,
    moving: false,
    
    isMoving: function() {
        return this.moving;
    },
    
    move: function() {
        if (this.moving) {
            if (this.x >= (CanvasManager.canvas.width - this.pacsize)) {
                this.x = 0;
            }
            if (this.y >= (CanvasManager.canvas.height - this.pacsize)) {
                this.y = 0;
            }
            if (this.x < 0) {
                this.x = CanvasManager.canvas.width - this.pacsize;
            }
            if (this.y < 0) {
                this.y = CanvasManager.canvas.height - this.pacsize;
            }

            this.x += this.dirx;
            this.y += this.diry;

        }
    },
    
    isOnLeft: function(x) {
        return this.x < x;
    },
    
    isOnTop: function(y) {
        return this.y < y;
    },
    
    draw: function() {
        CanvasManager.draw(this.pacmouth, this.pacdir, 32, 32, this.x, this.y, this.pacsize, this.pacsize);
    },
    
    animate: function() {
        if (this.moving == true) {
            if (this.pacmouth == 320) {
                this.pacmouth = 352;
            } else {
                this.pacmouth = 320;
            }
        }
    },
    
    moveLeft: function() {
        this.dirx = -this.speed;
        this.diry = 0;
        this.pacdir = 64;
        this.moving = true;
    },
    
    moveUp: function() {
        this.dirx = 0;
        this.diry = -this.speed;
        this.pacdir = 96;
        this.moving = true;
    },
    
    moveRight: function() {
        this.dirx = this.speed;
        this.diry = 0;
        this.pacdir = 0;
        this.moving = true;
    },
    
    moveDown: function() {
        this.dirx = 0;
        this.diry = this.speed;
        this.pacdir = 32;
        this.moving = true;
    }
}

/**
 * Enemy
 */
var Enemy = {
    x: 0,
    y: 0,
    speed: 3,
    moving: 0,
    eyedir: 0,
    dirx: 0,
    diry: 0,
    ghostNum: 64,
    
    move: function() {
        if(this.moving < 0) {
            this.moving = (num(15)*3)+10+num(2);
            //enemy.speed = num(5);
            this.dirx = 0;
            this.diry =0;
            if(this.moving % 2) {
                if (Player.isOnLeft(this.x)) {
                    this.dirx = -this.speed;
                    this.eyedir = 64;
                } else {
                    this.dirx = this.speed;
                    this.eyedir = 0;
                }
            } else {
                if (Player.isOnTop(this.y)) {
                    this.diry = -this.speed;
                    this.eyedir = 96;
                } else {
                    this.diry = this.speed;
                    this.eyedir = 32;
                }
            }
        }

        this.x += this.dirx;
        this.y += this.diry;
        this.moving--;

        if (this.x >= (CanvasManager.canvas.width - Player.pacsize)) {
            this.x = 0;
        }
        if (this.y >= (CanvasManager.canvas.height - Player.pacsize)) {
            this.y = 0;
        }
        if (this.x < 0) {
            this.x = CanvasManager.canvas.width - Player.pacsize;
        }
        if (this.y < 0) {
            this.y = CanvasManager.canvas.height - Player.pacsize;
        }
    },
    
    animate: function() {
        if (this.ghostNum % 64) {
            this.ghostNum -= 32;
        } else {
            this.ghostNum += 32;
        }
    },
    
    create: function() {
        Enemy.ghostNum = num(5) * 64;
        Enemy.x = num(450);
        Enemy.y = num(200);
    },
    
    draw: function() {
        CanvasManager.draw(this.ghostNum, this.eyedir, 32, 32, this.x, this.y, Player.pacsize, Player.pacsize);
    }
};

/**
 * Canvas manager
 */
var CanvasManager = {
    canvas: undefined,
    context: undefined,
    mainImage: undefined,
    
    initialize: function() {
        this.canvas = document.createElement("canvas");
        this.context = this.canvas.getContext("2d");
        // set height and width
        this.canvas.height = 400;
        this.canvas.width = 600;
        // load pakaman.png
        this.mainImage = new Image();
        this.mainImage.ready = false;
        this.mainImage.onload = this.checkReady;
        this.mainImage.src = "packman.png";
        
        // append to document
        document.getElementById("container").append(this.canvas);
    },
    
    checkReady: function() {
        CanvasManager.mainImage.ready = true;
        GameManager.playgame();
    },
    
    render: function() {
        this.context.fillStyle = "pink";
        this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    },
    
    renderText: function(text, left, top) {
        // add text of player score
        this.context.font = "20px Verdana";
        this.context.fillStyle = "blue";
        this.context.fillText(text, left, top);
    },
    
    draw: function(left, top, width, height, targetX, targetY, targetWidth, targetHeight) {
        this.context.drawImage(this.mainImage, left, top, width, height, targetX, targetY, targetWidth, targetHeight);
    }
};

/**
 * Game manager
 */
var GameManager = {
    score: 0,
    gscore: 0,
    ghost: false,
    keyclick: {},
    renderCount: 0,
    
    initialize: function() {
        CanvasManager.initialize();
        this.registerKeyCapture();
    },
    
    registerKeyCapture: function() {
        
        document.addEventListener("keydown", function (event) {
            GameManager.keyclick[event.keyCode] = true;
            GameManager.move(GameManager.keyclick);
        }, false);

        document.addEventListener("keyup", function (event) {
            delete GameManager.keyclick[event.keyCode];
        }, false);
        
    },
    
    playgame: function() {
        GameManager.render();
        requestAnimationFrame(GameManager.playgame);
    },
    
    render: function() {
        if (ControlPanel.isPaused()) {
            return ;
        }
        // fill canvas with background
        CanvasManager.render();

        if(!this.ghost) {
            Enemy.create();
            this.ghost = true;
        }

        Player.move();
        Enemy.move();

        if ((this.renderCount++) % 8 == 0) {
            Enemy.animate();
            Player.animate();
        }
        
        CanvasManager.renderText("Pacman: " + this.score + " vs Ghost: " + this.gscore, 5, 20);

        // draw player
        Player.draw();
        // draw enemy
        Enemy.draw();
    },

    move: function(keyclick) {
        //  alert("Keycode: " + JSON.stringify(keyclick));
        if (27 in keyclick) {
            ControlPanel.paussed();
        } else if (32 in keyclick) {
            ControlPanel.play();
        } else if (37 in keyclick) {
            Player.moveLeft();
        } else if (38 in keyclick) {
            Player.moveUp();
        } else if (39 in keyclick) {
            Player.moveRight();
        } else if (40 in keyclick) {
            Player.moveDown();
        }
    }

};

GameManager.initialize();
