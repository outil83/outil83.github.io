var document = window.document;
var Constants = {
    PACSIZE: 32
};

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

var Powerdot = {
    x: num(400),
    y: num(400),
    size: (Constants.PACSIZE / 4),
    present: false,
    
    isPresent: function() {
        return this.present;
    },
    
    create: function() {
        this.x = num(300) + 50;
        this.y = num(300) + 50;
        this.present = true;
    },
    
    draw: function() {
        if (this.isPresent()) {
            CanvasManager.drawCircle(this.x, this.y, this.size, "yellow");
        }
    },
    
    checkCollision: function(position, size) {
        if (!this.isPresent()) {
            return false;
        }
        if ((this.x - this.size) >= position.x 
            && (this.x + this.size) <= (position.x + size)
           && (this.y - this.size) >= position.y 
            && (this.y + this.size) <= (position.y + size)) {
            return true;
        }
        return false;
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
    
    getPosition: function() {
        return {x: this.x, y: this.y};
    },
    
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
    vulnerable: false,
    recoveryCount: 0,
    vulnerableGhostNum: 384,
    
    makeVulnerable: function() {
        this.vulnerable = true;
        this.recoveryCount = 640;
        this.speed = 2;
    },
    
    move: function() {
        if(this.moving < 0) {
            this.moving = (num(10)*3)+5+num(2);
            //enemy.speed = num(5);
            this.dirx = 0;
            this.diry = 0;
            var playerPosition = Player.getPosition();
            var distanceXvsY = Math.abs(playerPosition.x - this.x) - Math.abs(playerPosition.y - this.y);
            if ((this.vulnerable && distanceXvsY > 0) || (!this.vulnerable && distanceXvsY <= 0)) {
                if ((!this.vulnerable && Player.isOnTop(this.y)) || (this.vulnerable && !Player.isOnTop())) {
                    this.diry = -this.speed;
                    this.eyedir = 96;
                } else {
                    this.diry = this.speed;
                    this.eyedir = 32;
                }
            } else {
                if ((!this.vulnerable && Player.isOnLeft(this.x)) || (this.vulnerable && !Player.isOnLeft(this.x))) {
                    this.dirx = -this.speed;
                    this.eyedir = 64;
                } else {
                    this.dirx = this.speed;
                    this.eyedir = 0;
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
        
        if (this.vulnerable) {
            this.recoveryCount--;
        }
        if (this.recoveryCount < 0) {
            this.vulnerable = false;
            this.speed = 3;
        }
    },
    vulnerableAnimationCount: 0,
    animate: function() {
        if (this.vulnerable) {
            this.vulnerableAnimationCount++;
            if (this.vulnerableAnimationCount % 16 == 0) {
                this.vulnerableEyedir = this.vulnerableEyedir == 0 ? 32 : 0;
            }
            if (this.vulnerableGhostNum % 64) {
                this.vulnerableGhostNum -= 32;
            } else {
                this.vulnerableGhostNum += 32;
            }
        } else {
            if (this.ghostNum % 64) {
                this.ghostNum -= 32;
            } else {
                this.ghostNum += 32;
            }
        }
    },
    
    create: function() {
        Enemy.ghostNum = num(5) * 64;
        Enemy.x = num(450);
        Enemy.y = num(200);
    },
    
    draw: function() {
        if (!this.vulnerable) {
            CanvasManager.draw(this.ghostNum, this.eyedir, 32, 32, this.x, this.y, Constants.PACSIZE, Constants.PACSIZE);
        } else {
            CanvasManager.draw(this.vulnerableGhostNum, this.vulnerableEyedir, 32, 32, this.x, this.y, Constants.PACSIZE, Constants.PACSIZE);
        }
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
        this.canvas.height = 480;
        this.canvas.width = 480;
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
    },
    
    drawCircle: function(x, y, radius, fillColor) {
        this.context.fillStyle = fillColor;
        this.context.beginPath();
        this.context.arc(x, y, radius, 0, 2 * Math.PI, true);
        this.context.closePath();
        this.context.fill();
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
        
        if(!Powerdot.isPresent()) {
            Powerdot.create();
        }

        if(!this.ghost) {
            Enemy.create();
            this.ghost = true;
        }
        
        if(Powerdot.checkCollision(Player.getPosition(), Player.pacsize)) {
            Powerdot.present = false;
            Enemy.makeVulnerable();
            this.score++;
        }

        Powerdot.draw();
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
        
        if (this.renderCount > 32) {
            this.renderCount = 0;
        }
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
