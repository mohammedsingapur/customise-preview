// app.js
console.log("2. Loading App Logic...");

// SAFETY CHECK
if (!window.auth || !window.db) {
    alert("CRITICAL ERROR: Firebase not found. Check config.js keys.");
    throw new Error("Firebase missing");
}

let currentUser = null;
let currentImg = null;
let tempSrc = null;

// --- AUTH ---
window.auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        document.getElementById('login-view').style.display = 'none';
        document.getElementById('app-view').style.display = 'flex';
        
        window.db.collection('users').doc(user.uid).onSnapshot(doc => {
            if (!doc.exists) window.db.collection('users').doc(user.uid).set({email:user.email, credits:10});
            else document.getElementById('creds').innerText = (doc.data().credits || 0) + " Credits";
        });
        setTimeout(draw, 500);
    } else {
        document.getElementById('login-view').style.display = 'flex';
        document.getElementById('app-view').style.display = 'none';
    }
});

function handleLogin(e) {
    e.preventDefault();
    const em = document.getElementById('email').value;
    const pw = document.getElementById('pass').value;
    document.getElementById('log').innerText = "Logging in...";
    window.auth.signInWithEmailAndPassword(em, pw).catch(err => document.getElementById('log').innerText = err.message);
}

function handleSignup() {
    const em = document.getElementById('email').value;
    const pw = document.getElementById('pass').value;
    if(!em || !pw) return alert("Enter email & password");
    document.getElementById('log').innerText = "Creating account...";
    window.auth.createUserWithEmailAndPassword(em, pw).catch(err => document.getElementById('log').innerText = err.message);
}

// --- IMAGE ---
document.getElementById('file-in').addEventListener('change', e => {
    if (e.target.files[0]) {
        const r = new FileReader();
        r.onload = evt => { tempSrc = evt.target.result; document.getElementById('modal').style.display = 'flex'; };
        r.readAsDataURL(e.target.files[0]);
        e.target.value = ''; 
    }
});

async function closeModal(pay) {
    document.getElementById('modal').style.display = 'none';
    if(pay && tempSrc) {
        const ref = window.db.collection('users').doc(currentUser.uid);
        try {
            await window.db.runTransaction(async t => {
                const d = await t.get(ref);
                const c = d.data().credits || 0;
                if(c < 4) throw "Low Balance";
                t.update(ref, { credits: c - 4 });
            });
            const i = new Image();
            i.onload = () => { currentImg = i; draw(); };
            i.src = tempSrc;
        } catch(e) { alert(e); }
    }
}

// --- DRAW ---
function getV(id) { const e = document.getElementById(id); return parseFloat(e.value || e.placeholder) || 0; }

function draw() {
    const cvs = document.getElementById('cvs');
    const ctx = cvs.getContext('2d');
    
    // Inputs
    const tW = getV('tW'), tH = getV('tH'), gap = getV('gap');
    const sW = (document.getElementById('sW').value || "55,55").split(',').map(Number).filter(n=>n);
    const sH = (document.getElementById('sH').value || "90").split(',').map(Number).filter(n=>n);
    const cols = sW.length ? sW : [tW];
    const rows = sH.length ? sH : [tH];
    
    // Setup
    const PPI = 5, P = 20;
    const gW = cols.reduce((a,b)=>a+b,0), gH = rows.reduce((a,b)=>a+b,0);
    const vW = gW + (cols.length-1)*gap, vH = gH + (rows.length-1)*gap;
    
    cvs.width = (vW*PPI) + (P*2);
    cvs.height = (vH*PPI) + (P*2);
    
    ctx.fillStyle = "white"; ctx.fillRect(0,0,cvs.width, cvs.height);
    
    let cY = P, aH = 0;
    rows.forEach(h => {
        let cX = P, aW = 0;
        cols.forEach(w => {
            const dW = w*PPI, dH = h*PPI;
            
            // Draw Cell
            ctx.save();
            ctx.beginPath(); ctx.rect(cX, cY, dW, dH); ctx.clip();
            ctx.fillStyle = document.getElementById('clr').value; ctx.fill();
            
            if(currentImg) {
                const oX = cX - (aW*PPI), oY = cY - (aH*PPI);
                ctx.drawImage(currentImg, oX, oY, tW*PPI, tH*PPI);
            }
            
            ctx.stroke(); 
            ctx.restore();
            
            // Text
            ctx.fillStyle="black"; ctx.font="12px Arial"; ctx.textAlign="center";
            ctx.fillText(w+'"', cX+dW/2, cY+dH+15);
            ctx.save(); ctx.translate(cX-10, cY+dH/2); ctx.rotate(-Math.PI/2); ctx.fillText(h+'"',0,0); ctx.restore();

            cX += dW + gap*PPI; aW += w;
        });
        cY += h*PPI + gap*PPI; aH += h;
    });
}

function download() {
    const a = document.createElement('a');
    a.download = 'preview.png';
    a.href = document.getElementById('cvs').toDataURL();
    a.click();
}
.addEventListener('change', (e) => {
    if (e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = (evt) => openModal(evt.target.result);
        reader.readAsDataURL(e.target.files[0]);
        e.target.value = ''; 
    }
});

function handleLink() {
    const url = document.getElementById('link-in').value;
    if (url) openModal(url);
}

function openModal(src) {
    tempSrc = src;
    // For Preview Modal, we don't need CORS
    document.getElementById('modal-img').src = src;
    document.getElementById('modal').style.display = 'flex';
}

async function closeModal(shouldPay) {
    document.getElementById('modal').style.display = 'none';
    
    if (shouldPay && tempSrc) {
        const ref = db.collection('users').doc(currentUser.uid);
        try {
            await db.runTransaction(async (t) => {
                const doc = await t.get(ref);
                const creds = doc.data().credits || 0;
                if (creds < 4) throw "Insufficient Credits";
                t.update(ref, { credits: creds - 4 });
            });

            // LOAD IMAGE SAFELY (Fixes 403)
            const img = new Image();
            // IMPORTANT: We do NOT set crossOrigin here initially to ensure display works
            img.onload = () => {
                currentImg = img;
                attemptAutoColor(tempSrc); // Try color separately
                draw();
            };
            img.onerror = () => {
                alert("Image failed to load (Source blocked access). Try downloading it first.");
            };
            img.src = tempSrc;

        } catch (err) {
            alert("Error: " + err);
        }
    }
    tempSrc = null;
}

function attemptAutoColor(src) {
    // Attempt to load a second instance WITH CORS just for color
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
        try {
            const c = document.createElement('canvas'); 
            c.width = 1; c.height = 1;
            c.getContext('2d').drawImage(img, 0, 0, 1, 1);
            const p = c.getContext('2d').getImageData(0, 0, 1, 1).data;
            const hex = "#" + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1);
            document.getElementById('clr').value = hex;
            draw(); // Redraw with new color
        } catch(e) { console.log("Auto-color blocked by CORS (Harmless)"); }
    };
    img.src = src;
}

// --- DRAWING ENGINE ---
function getVal(id) {
    const el = document.getElementById(id);
    const val = el.value.trim() === "" ? el.placeholder : el.value;
    return parseFloat(val) || 0;
}

function draw() {
    const canvas = document.getElementById('main-canvas');
    const ctx = canvas.getContext('2d');

    const tW = getVal('tW');
    const tH = getVal('tH');
    const gap = getVal('gap');
    const clr = document.getElementById('clr').value;
    const shp = document.getElementById('shp').value;

    const sW_txt = document.getElementById('sW').value.trim() || document.getElementById('sW').placeholder;
    const sH_txt = document.getElementById('sH').value.trim() || document.getElementById('sH').placeholder;

    const cols = sW_txt.split(',').map(n => parseFloat(n)).filter(n => n > 0);
    const rows = sH_txt.split(',').map(n => parseFloat(n)).filter(n => n > 0);
    const finalCols = cols.length ? cols : [tW];
    const finalRows = rows.length ? rows : [tH];

    // PPI Config (5 is good balance for Phone Preview + Download)
    const PPI = 5; 
    const PADDING = 20;
    
    const gridW = finalCols.reduce((a, b) => a + b, 0);
    const gridH = finalRows.reduce((a, b) => a + b, 0);
    const visW = gridW + ((finalCols.length - 1) * gap);
    const visH = gridH + ((finalRows.length - 1) * gap);

    canvas.width = (visW * PPI) + (PADDING * 2);
    canvas.height = (visH * PPI) + (PADDING * 2);

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let curY = PADDING;
    let accH = 0;

    finalRows.forEach((h, rI) => {
        let curX = PADDING;
        let accW = 0;
        
        let rShp = 'rect';
        if(shp === 'circle') rShp = 'circle';
        if(shp === 'arch-top' && rI === 0) rShp = 'arch-top';
        if(shp === 'arch-bottom' && rI === finalRows.length - 1) rShp = 'arch-bottom';

        finalCols.forEach((w, cI) => {
            const dW = w * PPI;
            const dH = h * PPI;

            ctx.save();
            ctx.beginPath();
            tracePath(ctx, curX, curY, dW, dH, rShp, PPI);
            ctx.clip();

            ctx.fillStyle = clr; ctx.fill();

            if (currentImg) {
                const orgX = curX - (accW * PPI);
                const orgY = curY - (accH * PPI);
                ctx.save();
                ctx.beginPath();
                ctx.rect(orgX, orgY, tW * PPI, tH * PPI);
                ctx.clip();
                try {
                    ctx.drawImage(currentImg, orgX, orgY, tW * PPI, tH * PPI);
                } catch(e) { console.error("Draw Error"); }
                ctx.restore();
            }
            ctx.restore();

            ctx.lineWidth = 2; ctx.strokeStyle = "#333";
            ctx.beginPath();
            tracePath(ctx, curX, curY, dW, dH, rShp, PPI);
            ctx.stroke();

            ctx.fillStyle = "black"; ctx.font = "bold 14px Arial"; ctx.textAlign = "center";
            ctx.fillText(w + '"', curX + dW / 2, curY + dH + 20);
            
            ctx.save();
            ctx.translate(curX - 10, curY + dH / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(h + '"', 0, 0);
            ctx.restore();

            curX += dW + (gap * PPI);
            accW += w;
        });
        curY += (dH = h * PPI) + (gap * PPI);
        accH += h;
    });
}

function tracePath(ctx, x, y, w, h, type, ppi) {
    const d = Math.min(h, 10 * ppi);
    if (type === 'rect') ctx.rect(x, y, w, h);
    else if (type === 'circle') ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 2 * Math.PI);
    else if (type === 'arch-top') {
        ctx.moveTo(x, y + h); ctx.lineTo(x, y + d);
        ctx.bezierCurveTo(x, y, x + w, y, x + w, y + d);
        ctx.lineTo(x + w, y + h);
    } else if (type === 'arch-bottom') {
        ctx.moveTo(x, y); ctx.lineTo(x + w, y);
        ctx.lineTo(x + w, y + h - d);
        ctx.bezierCurveTo(x + w, y + h, x, y + h, x, y + h - d);
        ctx.lineTo(x, y);
    }
    ctx.closePath();
}

function downloadCanvas() {
    const link = document.createElement('a');
    link.download = 'hakimi-preview.png';
    link.href = document.getElementById('main-canvas').toDataURL();
    link.click();
}
    e.preventDefault();
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    const errBox = document.getElementById('auth-error');
    
    errBox.innerText = "Signing in...";
    
    auth.signInWithEmailAndPassword(email, pass)
        .catch((error) => {
            errBox.innerText = error.message;
        });
}

function handleSignup(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    const errBox = document.getElementById('auth-error');

    if(!email || !pass) {
        return errBox.innerText = "Please fill email & password to register";
    }

    errBox.innerText = "Creating account...";
    
    auth.createUserWithEmailAndPassword(email, pass)
        .catch((error) => {
            errBox.innerText = error.message;
        });
}

// --- IMAGE HANDLING ---
const fileInput = document.getElementById('file-in');

fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = (evt) => openModal(evt.target.result);
        reader.readAsDataURL(e.target.files[0]);
        e.target.value = ''; // Reset
    }
});

function handleLink() {
    const url = document.getElementById('link-in').value;
    if (url) openModal(url);
}

function openModal(src) {
    tempSrc = src;
    document.getElementById('modal-img').src = src;
    document.getElementById('modal').style.display = 'flex';
}

async function closeModal(shouldPay) {
    document.getElementById('modal').style.display = 'none';
    
    if (shouldPay && tempSrc) {
        const ref = db.collection('users').doc(currentUser.uid);
        
        try {
            await db.runTransaction(async (t) => {
                const doc = await t.get(ref);
                const creds = doc.data().credits || 0;
                if (creds < 4) throw "Insufficient Credits";
                t.update(ref, { credits: creds - 4 });
            });

            // Load Image
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                currentImg = img;
                autoColor(img);
                draw();
            };
            img.src = tempSrc;

        } catch (err) {
            alert("Error: " + err);
        }
    }
    tempSrc = null;
}

function autoColor(img) {
    try {
        const c = document.createElement('canvas'); 
        c.width = 1; c.height = 1;
        c.getContext('2d').drawImage(img, 0, 0, 1, 1);
        const p = c.getContext('2d').getImageData(0, 0, 1, 1).data;
        const hex = "#" + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1);
        document.getElementById('clr').value = hex;
    } catch (e) {
        console.log("CORS restricted color detect");
    }
}

// --- DRAWING ENGINE ---
function getVal(id) {
    const el = document.getElementById(id);
    const val = el.value.trim() === "" ? el.placeholder : el.value;
    return parseFloat(val) || 0;
}

function draw() {
    const canvas = document.getElementById('main-canvas');
    const ctx = canvas.getContext('2d');

    const tW = getVal('tW');
    const tH = getVal('tH');
    const gap = getVal('gap');
    const clr = document.getElementById('clr').value;
    const shp = document.getElementById('shp').value;

    const sW_txt = document.getElementById('sW').value.trim() || document.getElementById('sW').placeholder;
    const sH_txt = document.getElementById('sH').value.trim() || document.getElementById('sH').placeholder;

    const cols = sW_txt.split(',').map(n => parseFloat(n)).filter(n => n > 0);
    const rows = sH_txt.split(',').map(n => parseFloat(n)).filter(n => n > 0);
    
    const finalCols = cols.length ? cols : [tW];
    const finalRows = rows.length ? rows : [tH];

    // Config
    const PPI = 5;
    const PADDING = 40;
    
    const gridW = finalCols.reduce((a, b) => a + b, 0);
    const gridH = finalRows.reduce((a, b) => a + b, 0);
    const visW = gridW + ((finalCols.length - 1) * gap);
    const visH = gridH + ((finalRows.length - 1) * gap);

    canvas.width = (visW * PPI) + (PADDING * 2);
    canvas.height = (visH * PPI) + (PADDING * 2);

    // BG
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let curY = PADDING;
    let accH = 0;

    finalRows.forEach((h, rI) => {
        let curX = PADDING;
        let accW = 0;
        
        let rShp = 'rect';
        if(shp === 'circle') rShp = 'circle';
        if(shp === 'arch-top' && rI === 0) rShp = 'arch-top';
        if(shp === 'arch-bottom' && rI === finalRows.length - 1) rShp = 'arch-bottom';

        finalCols.forEach((w, cI) => {
            const dW = w * PPI;
            const dH = h * PPI;

            ctx.save();
            ctx.beginPath();
            tracePath(ctx, curX, curY, dW, dH, rShp, PPI);
            ctx.clip();

            // Fill
            ctx.fillStyle = clr;
            ctx.fill();

            // Image
            if (currentImg) {
                const orgX = curX - (accW * PPI);
                const orgY = curY - (accH * PPI);
                
                ctx.save();
                ctx.beginPath();
                ctx.rect(orgX, orgY, tW * PPI, tH * PPI);
                ctx.clip();
                ctx.drawImage(currentImg, orgX, orgY, tW * PPI, tH * PPI);
                ctx.restore();
            }
            ctx.restore();

            // Stroke
            ctx.lineWidth = 2;
            ctx.strokeStyle = "#333";
            ctx.beginPath();
            tracePath(ctx, curX, curY, dW, dH, rShp, PPI);
            ctx.stroke();

            // Text
            ctx.fillStyle = "black";
            ctx.font = "bold 13px Arial";
            ctx.textAlign = "center";
            ctx.fillText(w + '"', curX + dW / 2, curY + dH + 20);
            
            ctx.save();
            ctx.translate(curX - 15, curY + dH / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(h + '"', 0, 0);
            ctx.restore();

            curX += dW + (gap * PPI);
            accW += w;
        });
        curY += (dH = h * PPI) + (gap * PPI);
        accH += h;
    });
}

function tracePath(ctx, x, y, w, h, type, ppi) {
    const d = Math.min(h, 10 * ppi);
    if (type === 'rect') ctx.rect(x, y, w, h);
    else if (type === 'circle') ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 2 * Math.PI);
    else if (type === 'arch-top') {
        ctx.moveTo(x, y + h); ctx.lineTo(x, y + d);
        ctx.bezierCurveTo(x, y, x + w, y, x + w, y + d);
        ctx.lineTo(x + w, y + h);
    } else if (type === 'arch-bottom') {
        ctx.moveTo(x, y); ctx.lineTo(x + w, y);
        ctx.lineTo(x + w, y + h - d);
        ctx.bezierCurveTo(x + w, y + h, x, y + h, x, y + h - d);
        ctx.lineTo(x, y);
    }
    ctx.closePath();
}

function downloadCanvas() {
    const link = document.createElement('a');
    link.download = 'hakimi-preview.png';
    link.href = document.getElementById('main-canvas').toDataURL();
    link.click();
}
