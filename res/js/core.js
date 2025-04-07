"use strict";

// assets 
var csvSrc = "res/csv/atlas.csv";
var atlasSrc = "res/img/atlas.png";

// game size
var width = 288;      // 游戏画面宽度
var height = 512;     // 游戏画面高度

// physics
var xVel = -4;        // 水平移动速度
var gravity = 1.5;    // 重力加速度
var jumpVel = -14;    // 跳跃初始速度
var maxFallVel = 15;  // 最大下落速度

// bird
var birdX = 69;       // 小鸟的固定X坐标
var birdStartY = 236; // 小鸟的初始Y坐标
var birdWidth = 25;   // 小鸟碰撞箱宽度
var birdHeight = 15;  // 小鸟碰撞箱高度
var birdRenderOffsetX = -11;  // 小鸟渲染X偏移量
var birdRenderOffsetY = -18;  // 小鸟渲染Y偏移量

// bird animation
var sineWaveA = 15;   // 正弦波振幅(准备状态下小鸟上下摆动)
var sineWaveT = 45;   // 正弦波周期
var swingT = 5;       // 翅膀摆动周期

// pipe
var pipeWidth = 48;   // 管道宽度
var pipeHeight = 320; // 管道高度
var pipeSpacing = 172;// 管道间距
var pipeGap = 90;     // 上下管道间隙
var pipeStartX = 360; // 管道初始X坐标
var pipeRandomBoundary = 50;  // 管道随机位置边界

// land
var landStartX = 0;   // 地面初始X坐标
var landWidth = 288;  // 地面宽度
var landY = 400;      // 地面Y坐标

// ql (Q-Learning参数)
var qlAlpha = 0.6;    // 学习率
var qlGamma = 0.8;    // 折扣因子
var qlResolution = 15;// 状态空间分辨率
var qlAliveReward = 1;// 存活奖励
var qlDeadReward = -100;  // 死亡惩罚
var qlEpsilon = 0;    // 探索率
var qlExploreJumpRate = 0.1;  // 探索时跳跃概率

// init fps
var inverseDefaultFPS = 1000 / 40;  // 默认帧率的倒数(ms)

// dead animation
var deadFlashFrame = 5;   // 死亡闪烁帧数

// play ui
var playingScoreMidX = 144;   // 游戏中分数X中心坐标
var playingScoreY = 41;       // 游戏中分数Y坐标
var playingScoreSpacing = 22; // 游戏中分数数字间距

// game over ui
var gameOverTextX = 40;       // Game Over文字X坐标
var gameOverTextY = 123;      // Game Over文字Y坐标
var gameOverPanelX = 24;      // 结算面板X坐标
var gameOverPanelY = 195;     // 结算面板Y坐标
var panelScoreRightX = 218;   // 面板分数右对齐X坐标
var panelScoreY = 231;        // 面板当前分数Y坐标
var panelMaxScoreY = 272;     // 面板最高分Y坐标
var panelScoreSpacing = 16;   // 面板分数数字间距
var medalX = 55;              // 奖牌X坐标
var medalY = 240;             // 奖牌Y坐标

// ready ui
var tutorialX = 88;           // 教程图片X坐标
var tutorialY = 218;          // 教程图片Y坐标
var readyTextX = 46;          // Ready文字X坐标
var readyTextY = 146;         // Ready文字Y坐标

function first(v) {
    return v.length > 0 ? v[0] : null;
}

function second(v) {
    return v.length > 1 ? [1] : null;
}

function last(v) {
    return v[v.length - 1];
}

function max(v) {
    if (!v || v.length === 0) return null;

    var index = 0;
    for (var i = 1; i < v.length; ++i) {
        index = v[i] > v[index] ? i : index;
    }
    return v[index];
}

function translate(startPos, vel, time) {
    return Math.floor(time * vel + startPos);
}

function apply(x, funcs) {
    funcs.forEach(function (f) {
        x = f(x);
    });
    return x;
}

function startingState() {
    return {
        mode: "ready",          // 游戏状态：ready（准备）, playing（游戏中）, dead（死亡）
        startFrame: 0,          // 游戏开始时的帧数
        jumpFrame: 0,           // 最后一次跳跃的帧数
        birdY: birdStartY,      // 小鸟的当前Y坐标
        curFrame: 0,            // 当前帧数
        birdSprite: 0,         // 小鸟动画帧索引（0-2）
        round: 0,              // 当前回合数
        score: 0,              // 当前回合得分
        totalScore: 0,         // 所有回合总得分
        maxScore: 0,           // 最高得分记录
        deadFlash: 0,          // 死亡闪烁效果计数器
        fps: 0,                // 当前帧率
        pipeList: [],          // 管道对象列表
        landList: [],          // 地面对象列表
    };
}

function resetState(gameState) {
    var round = gameState.round;
    var curFrame = gameState.curFrame;
    var totalScore = gameState.totalScore;
    var maxScore = gameState.maxScore;
    var score = gameState.score;

    var gameState = startingState();

    gameState.startFrame = curFrame;
    gameState.curFrame = curFrame;
    gameState.round = round + 1;
    gameState.totalScore = totalScore;
    gameState.maxScore = maxScore;

    return gameState;
}

function curPipePos(curFrame, pipe) {
    return translate(pipe.startX, xVel, curFrame - pipe.startFrame);
}

function curLandPos(curFrame, land) {
    return translate(land.startX, xVel, curFrame - land.startFrame);
}

function inPipe(pipe) {
    return birdX + birdWidth >= pipe.curX && birdX < pipe.curX + pipeWidth;
}

function inPipeGap(birdY, pipe) {
    return pipe.gapTop < birdY && (pipe.gapTop + pipeGap) > birdY + birdHeight;
}

function collideGround(birdY) {
    return birdY + birdHeight >= landY;
}

function updateCollision(gameState) {
    var birdY = gameState.birdY;
    var pipeList = gameState.pipeList;

    if (pipeList.some(function (pipe) {
        return (inPipe(pipe) &&
            !inPipeGap(birdY, pipe)) ||
            collideGround(birdY);
    })) {
        gameState.mode = "dead";
    }

    return gameState;
}

function newPipe(curFrame, startX) {
    return {
        startFrame: curFrame,
        startX: startX,
        curX: startX,
        gapTop: Math.floor(pipeRandomBoundary + Math.random() * (landY - pipeGap - 2 * pipeRandomBoundary))
    };
}

function newLand(curFrame, startX) {
    return {
        startFrame: curFrame,
        startX: startX,
        curX: startX,
    };
}

function updatePipes(gameState) {
    if (gameState.mode != "playing") return gameState;

    var curFrame = gameState.curFrame;
    var pipeList = gameState.pipeList.map(function (pipe) {
        pipe.curX = curPipePos(curFrame, pipe);
        return pipe;
    }).filter(function (pipe) {
        return pipe.curX > -pipeWidth;
    }).sort(function (a, b) {
        return a.curX - b.curX;
    });

    while (pipeList.length < 3) {
        var lastPipe = last(pipeList);
        pipeList.push(newPipe(curFrame, lastPipe ? lastPipe.curX + pipeSpacing : pipeStartX));
    }

    gameState.pipeList = pipeList;
    return gameState;
}

function updateLand(gameState) {
    if (gameState.mode == "dead") return gameState;

    var curFrame = gameState.curFrame;
    var landList = gameState.landList.map(function (land) {
        land.curX = curLandPos(curFrame, land);
        return land;
    }).filter(function (land) {
        return land.curX > -landWidth;
    }).sort(function (a, b) {
        return a.curX - b.curX;
    });

    while (landList.length < 2) {
        var lastLand = last(landList);
        landList.push(newLand(curFrame, lastLand ? lastLand.curX + landWidth : landStartX));
    }

    gameState.landList = landList;
    return gameState;
}

function animation(gameState) {
    var mode = gameState.mode;
    var curFrame = gameState.curFrame;

    if (mode === "ready" || mode === "playing")
        gameState.birdSprite = Math.floor(curFrame / swingT) % 3; // 控制小鸟翅膀扇动动画
    /*
        1. swingT = 5 ：翅膀摆动周期，每5帧切换一次动画
        2. curFrame / swingT ：当前帧数除以周期，随时间缓慢增加
        3. Math.floor() ：向下取整，使数值阶梯式增长
        4. % 3 ：取余数，使结果在 0、1、2 之间循环
        所以：

        - 当 curFrame = 0-4 时，birdSprite = 0
        - 当 curFrame = 5-9 时，birdSprite = 1
        - 当 curFrame = 10-14 时，birdSprite = 2
        - 当 curFrame = 15-19 时，又回到 birdSprite = 0
        - 以此类推...
    */

    if (mode === "ready") // 在 "ready" 状态下（游戏还未开始时）创建小鸟上下摆动的动画效果
        gameState.birdY = birdStartY + sineWaveA * Math.sin(curFrame * Math.PI * 2 / sineWaveT);

    if (mode === "dead") {
        gameState.deadFlash += 1;
    }

    return gameState;
}

function updateBird(gameState) {
    var curFrame = gameState.curFrame;
    var jumpFrame = gameState.jumpFrame;
    var birdY = gameState.birdY;
    var mode = gameState.mode;
    if (mode === "playing") {
        var curVel = Math.min(jumpVel + gravity * (curFrame - jumpFrame), maxFallVel);
        var newY = Math.min(birdY + curVel, landY - birdHeight); // 新位置不能到地面以下
        var newY = Math.max(newY, -birdHeight); // 新位置不能突破天花板
        gameState.birdY = newY;
    }
    return animation(gameState);
}

function updateScore(gameState) {
    if (gameState.mode == "playing") {
        var curFrame = gameState.curFrame;
        var startFrame = gameState.startFrame;
        var distance = (curFrame - startFrame) * Math.abs(xVel) + (pipeWidth + birdWidth) * 0.5;
        var newScore = Math.max(Math.floor((distance - pipeStartX + pipeSpacing) / pipeSpacing), 0);
        if (newScore - gameState.score === 1) {
            gameState.score += 1;
            gameState.totalScore += 1;
            gameState.maxScore = Math.max(gameState.score, gameState.maxScore);
        }
    }

    return gameState;
}

function jump(gameState) {
    var mode = gameState.mode;
    var curFrame = gameState.curFrame;

    if (mode !== "dead") {
        gameState.jumpFrame = curFrame;
    }

    if (mode === "ready") {
        gameState.startFrame = curFrame;
        gameState.mode = "playing";
    } else if (mode === "dead" && gameState.deadFlash > deadFlashFrame) {
        gameState = resetState(gameState);
        gameState = jump(gameState);
    }

    return gameState;
}

function getQLState(gameState) {
    var pipeList = gameState.pipeList;
    var birdY = gameState.birdY;
    var pipeList = pipeList.filter(function (pipe) {
        return birdX < pipe.curX + pipeWidth;
    }).sort(function (a, b) {
        return a.curX - b.curX;
    });

    var firstPipe = first(pipeList);
    var S = null;

    if (firstPipe) {
        S = [Math.floor(firstPipe.curX / qlResolution),
        Math.floor((firstPipe.gapTop - birdY) / qlResolution),
        ].join(',');
    }

    return S;
}

function reward(Q, S, S_, A, R) { // q-learning的状态更新公式
    if (S && S_ && A in [0, 1] && S in Q && S_ in Q)
        Q[S][A] = (1 - qlAlpha) * Q[S][A] + qlAlpha * (R + qlGamma * max(Q[S_]));
    return Q;
}

function updateQL(gameState) {
    if (!updateQL.enabled) return gameState;

    if (updateQL.skip) {
        updateQL.A = null;
        updateQL.S = null;
    }

    if (!updateQL.Q) {  // 状态记录表格 - Q
        updateQL.Q = {};
        updateQL.S = null;
    }

    var Q = updateQL.Q;

    // prev state
    var S = updateQL.S;
    // prev action 
    var A = updateQL.A;
    // current state
    var S_ = getQLState(gameState); // 下一个状态

    if (S_ && !(S_ in Q)) Q[S_] = [0, 0];

    if (gameState.mode == "playing") { // 如果存活, 更新Q-table, 以及当前状态
        updateQL.Q = reward(Q, S, S_, A, qlAliveReward);
        updateQL.S = S_;

        // current action, 0 for stay, 1 for jump
        var A_ = 0;

        if (Math.random() < qlEpsilon) { // explore
            A_ = Math.random() < qlExploreJumpRate ? 1 : 0;
        } else if (S_ in Q) { // exploit 
            A_ = Q[S_][0] >= Q[S_][1] ? 0 : 1;
        }

        if (A_ === 1) gameState = jump(gameState);
        updateQL.A = A_;
    } else if (gameState.mode == "dead") { // 如果死亡
        updateQL.Q = reward(Q, S, S_, A, qlDeadReward);
        updateQL.S = null;
        updateQL.A = null;

        // restart the game
        updateQL.skip = false;
        gameState = jump(gameState);
    }

    return gameState;
}

function update(gameState, frameStamp) {
    gameState.curFrame = frameStamp;
    gameState.deltaTime = frameStamp - gameState.jumpFrame;
    return apply(gameState, [
        updateLand,
        updateBird,
        updatePipes,
        updateScore,
        updateCollision,
        updateQL,
    ]);
}

function drawSprite(spriteName, x, y) {
    var sprite = render.sprites[spriteName]
    render.ctx.drawImage(render.image, sprite[2], sprite[3], sprite[0], sprite[1], x, y, sprite[0], sprite[1]);
}

function render(gameState) {  // 在 JavaScript 中，函数也是对象，可以给函数对象添加属性。这是 JavaScript 的一个特殊特性。
    if (!render.cvs || !render.ctx) {
        render.cvs = document.getElementById("cvs");
        render.cvs.width = width;
        render.cvs.height = height;
        render.ctx = render.cvs.getContext("2d");
        render.image = new Image();
        render.sprites = {};
        render.resourcesLoaded = false;

        render.ctx.font = render.ctx.font.replace(/\d+px/, "14px");

        render.image.addEventListener("load", function () {
            $.get(csvSrc, function (result) {
                result.split('\n').forEach(function (line) {
                    let values = line.split(' ');
                    render.sprites[values[0]] = [
                        Math.round(parseInt(values[1], 10)),
                        Math.round(parseInt(values[2], 10)),
                        Math.round(parseFloat(values[3]) * render.image.width),
                        Math.round(parseFloat(values[4]) * render.image.height)
                    ];
                });
                render.resourcesLoaded = true;
            });
        });
        render.image.src = atlasSrc;
    }

    var ctx = render.ctx;

    if (render.resourcesLoaded) {
        // clear
        ctx.fillRect(0, 0, render.cvs.width, render.cvs.height);

        // draw background
        drawSprite("bg_day", 0, 0);

        // draw pipes
        gameState.pipeList.forEach(function (pipe) {
            drawSprite("pipe_down", pipe.curX, pipe.gapTop - pipeHeight) // v
            drawSprite("pipe_up", pipe.curX, pipe.gapTop + pipeGap); // ^
        });

        // draw land
        gameState.landList.forEach(function (land) {
            drawSprite("land", land.curX, landY);
        });

        // draw bird
        var birdY = gameState.birdY;
        var birdSprite = gameState.birdSprite;
        drawSprite("bird0_" + birdSprite, birdX + birdRenderOffsetX, birdY + birdRenderOffsetY);

        if (gameState.mode === "playing") {
            // draw score
            var score = gameState.score.toString();
            for (var i = 0; i < score.length; ++i) {
                var digit = score[i];
                drawSprite("font_0" + (48 + parseInt(digit)), playingScoreMidX + (i - score.length / 2) * playingScoreSpacing, playingScoreY)
            }
        } else if (gameState.mode === "ready") {
            drawSprite("text_ready", readyTextX, readyTextY);
            drawSprite("tutorial", tutorialX, tutorialY);
        } else if (gameState.mode === "dead") {
            drawSprite("text_game_over", gameOverTextX, gameOverTextY);
            drawSprite("score_panel", gameOverPanelX, gameOverPanelY);

            // draw score
            var score = gameState.score.toString();
            for (var i = 0; i < score.length; ++i) {
                var digit = score[score.length - i - 1];
                drawSprite("number_score_0" + digit, panelScoreRightX - i * panelScoreSpacing, panelScoreY);
            }

            // draw max score
            var maxScore = gameState.maxScore.toString();
            for (var i = 0; i < maxScore.length; ++i) {
                var digit = maxScore[maxScore.length - i - 1];
                drawSprite("number_score_0" + digit, panelScoreRightX - i * panelScoreSpacing, panelMaxScoreY);
            }

            // draw medal
            var medal;
            if (score >= 30) medal = "3";
            else if (score >= 20) medal = "2";
            else if (score >= 10) medal = "1";
            else if (score >= 5) medal = "0";
            if (medal)
                drawSprite("medals_" + medal, medalX, medalY);

            if (gameState.deadFlash < deadFlashFrame) {
                ctx.globalAlpha = 1 - gameState.deadFlash / deadFlashFrame;
                ctx.fillRect(0, 0, render.cvs.width, render.cvs.height);
                ctx.globalAlpha = 1.0;
            }
        }
    }
}

var gameState = startingState();

cvs.addEventListener("mousedown", function (e) {
    e.preventDefault();
    // to avoid users mislead the bird when training
    if (updateQL.enabled) updateQL.skip = true;
    gameState = jump(gameState);
});

cvs.addEventListener("touchstart", function (e) {
    e.preventDefault();
    // to avoid users mislead the bird when training
    if (updateQL.enabled) updateQL.skip = true;
    gameState = jump(gameState);
});

function gameLoop() {
    if (!gameLoop.timeScale) {
        gameLoop.timeScale = 1;
        gameLoop.frameCount = 0;
        gameLoop.lastTime = (new Date).getTime();
    }

    gameState = update(gameState, gameLoop.frameCount++);
    render(gameState);

    // draw fps
    var curTime = (new Date).getTime();
    var lastTime = gameLoop.lastTime;
    gameLoop.lastTime = curTime;
    render.ctx.fillText(Math.floor(1000 / (curTime - lastTime)) + 'fps', 15, 25);

    gameLoop.eachFrame.update(gameState);

    setTimeout(gameLoop, inverseDefaultFPS / gameLoop.timeScale);
}

gameLoop.eachFrame = function (cb) {
    if (!gameLoop.eachFrame.callbacks) {
        gameLoop.eachFrame.callbacks = [];
    }
    gameLoop.eachFrame.callbacks.push(cb);
}

gameLoop.eachFrame.update = function (gameState) {
    (gameLoop.eachFrame.callbacks || []).forEach(function (cb) {
        cb(gameState);
    });
}

gameLoop.start = function () {
    setTimeout(gameLoop, inverseDefaultFPS);
}

console.log("core.js loaded");