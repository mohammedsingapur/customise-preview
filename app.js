// app.js

// --- GLOBAL STATE ---
let currentUser = null;
let currentImg = null;
let tempSrc = null;

// --- 1. AUTHENTICATION LOGIC ---

// Listen for Auth Changes
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        toggleViews(true);
        
        // Setup User DB & Listen to Credits
        const userRef = db.collection('users').doc(user.uid);
        userRef.onSnapshot((doc) => {
            if (!doc.exists) {
                userRef.set({ email: user.email, credits: 10 });
            } else {
                updateCreditUI(doc.data().credits || 0);
            }
        });
        
        // Initial Draw
        setTimeout(draw, 200);
    } else {
        currentUser = null;
        toggleViews(false);
    }
});

function toggleViews(isLoggedIn) {
    const loginView = document.getElementById('login-view');
    const appView = document.getElementById('app-view');
    
    if (isLoggedIn) {
        loginView.style.display = 'none';
        appView.style.display = 'flex';
    } else {
        loginView.style.display = 'flex';
        appView.style.display = 'none';
    }
}

function updateCreditUI(amount) {
    const badge = document.getElementById('credit-badge');
    badge.innerText = `${amount} Credits`;
    badge.style.color = amount < 4 ? '#dc2626' : '#2563eb';
}

// Login Handler
function handleLogin(e) {
    e.preventDefault(); // STOPS PAGE REFRESH
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    const log = document.getElementById('auth-log');

    log.innerText = "Authenticating...";
    
    auth.signInWithEmailAndPassword(email, pass)
        .catch(err => log.innerText = err.message);
}

// Signup Handler
function handleSignup(e) {
    e.preventDefault(); // STOPS PAGE REFRESH
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    const log = document.getElementById('auth-log');

    log.innerText = "Creating Account...";
    
    auth.createUserWithEmailAndPassword(email, pass)
        .catch(err => log.innerText = err.message);
}

function handleLogout() {
    auth.signOut();
}


// --- 2. IMAGE LOADING SYSTEM ---

// File Input
const fileInput = document.getElementById('file-in');
fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = (evt) => openModal(evt.target.result);
        reader.readAsDataURL(e.target.files[0]);
        e.target.value = ''; // Reset
    }
});

// Link Input
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
        const userRef = db.collection('users').doc(currentUser.uid);
        
        try {
            // 1. Deduct Credits
            await db.runTransaction(async (t) => {
                const doc = await t.get(userRef);
                const creds = doc.data().credits || 0;
                if (creds < 4) throw "Insufficient Credits";
                t.update(userRef, { credits: creds - 4 });
            });

            // 2. Load Image
            const img = new Image();
            // Note: We do NOT use crossOrigin here to avoid 403 errors on protected images.
            // This means we can display the image, but `getImageData` (Auto Color) might fail silently.
            img.onload = () => {
                currentImg = img;
                tryAutoColor(tempSrc); // Try color detection separately
                draw();
            };
            img.onerror = () => alert("Failed to load image. Check the URL.");
            img.src = tempSrc;

        } catch (err) {
            alert("Error: " + err);
        }
    }
    tempSrc = null;
}

function tryAutoColor(src) {
    // We create a separate image instance just for color detection
    // If this fails due to CORS, it won't crash the main app
    const i = new Image();
    i.crossOrigin = "Anonymous";
    i.onload = () => {
        try {
            const c = document.createElement('canvas'); 
            c.width = 1; c.height = 1;
            c.getContext('2d').drawImage(i, 0, 0, 1, 1);
            const p = c.getContext('2d').getImageData(0, 0, 1, 1).data;
            const hex = "#" + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1);
            document.getElementById('clr').value = hex;
            draw();
        } catch (e) { console.warn("Auto-color blocked (CORS)"); }
    };
    i.src = src;
}


// --- 3. DRAWING ENGINE ---

function getVal(id) {
    const el = document.getElementById(id);
    // Use placeholder if value is empty
    const val = el.value.trim() === "" ? el.placeholder : el.value;
    return parseFloat(val) || 0;
}

function draw() {
    const canvas = document.getElementById('main-canvas');
    const ctx = canvas.getContext('2d');

    // Inputs
    const tW = getVal('tW');
    const tH = getVal('tH');
    const gap = getVal('gap');
    const clr = document.getElementById('clr').value;
    const shp = document.getElementById('shp').value;

    // Grid Parsing
    const sW_el = document.getElementById('sW');
    const sH_el = document.getElementById('sH');
    const sW_txt = sW_el.value.trim() || sW_el.placeholder;
    const sH_txt = sH_el.value.trim() || sH_el.placeholder;

    const cols = sW_txt.split(',').map(n => parseFloat(n)).filter(n => n > 0);
    const rows = sH_txt.split(',').map(n => parseFloat(n)).filter(n => n > 0);
    
    // Defaults
    const finalCols = cols.length ? cols : [tW];
    const finalRows = rows.length ? rows : [tH];

    // Canvas Settings
    const PPI = 5; 
    const PADDING = 20;
    
    const gridW = finalCols.reduce((a, b) => a + b, 0);
    const gridH = finalRows.reduce((a, b) => a + b, 0);
    
    const visW = gridW + ((finalCols.length - 1) * gap);
    const visH = gridH + ((finalRows.length - 1) * gap);

    canvas.width = (visW * PPI) + (PADDING * 2);
    canvas.height = (visH * PPI) + (PADDING * 2);

    // Background
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let curY = PADDING;
    let accH = 0;

    finalRows.forEach((h, rI) => {
        let curX = PADDING;
        let accW = 0;
        
        // Row Shape Logic
        let rShp = 'rect';
        if(shp === 'circle') rShp = 'circle';
        if(shp === 'arch-top' && rI === 0) rShp = 'arch-top';
        if(shp === 'arch-bottom' && rI === finalRows.length - 1) rShp = 'arch-bottom';

        finalCols.forEach((w, cI) => {
            const dW = w * PPI;
            const dH = h * PPI;

            ctx.save();
            
            // 1. Define Path
            ctx.beginPath();
            tracePath(ctx, curX, curY, dW, dH, rShp, PPI);
            ctx.clip();

            // 2. Fill Color
            ctx.fillStyle = clr;
            ctx.fill();

            // 3. Draw Image (Cropped)
            if (currentImg) {
                const orgX = curX - (accW * PPI);
                const orgY = curY - (accH * PPI);
                
                ctx.save();
                ctx.beginPath();
                ctx.rect(orgX, orgY, tW * PPI, tH * PPI);
                ctx.clip();
                try { ctx.drawImage(currentImg, orgX, orgY, tW * PPI, tH * PPI); } catch(e){}
                ctx.restore();
            }
            ctx.restore();

            // 4. Stroke
            ctx.lineWidth = 2;
            ctx.strokeStyle = "#333";
            ctx.beginPath();
            tracePath(ctx, curX, curY, dW, dH, rShp, PPI);
            ctx.stroke();

            // 5. Text
            ctx.fillStyle = "black";
            ctx.font = "bold 13px Arial";
            ctx.textAlign = "center";
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
    const errBox = document.getElementById('auth-error');
    
    errBox.innerText = "Verifying...";
    auth.signInWithEmailAndPassword(email, pass).catch(err => errBox.innerText = err.message);
}

function handleSignup(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    const errBox = document.getElementById('auth-error');
    
    errBox.innerText = "Creating account...";
    auth.createUserWithEmailAndPassword(email, pass).catch(err => errBox.innerText = err.message);
}

// --- IMAGE HANDLING (403 FIX) ---
const fileInput = document.getElementById('file-in');

fileInput.addEventListener('change', (e) => {
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
