// app.js

// --- STATE ---
let currentUser = null;
let currentImg = null;
let tempSrc = null;

// --- AUTHENTICATION ---
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        document.getElementById('login-view').style.display = 'none';
        document.getElementById('app-view').style.display = 'flex';
        
        // Listen to Credits
        const userRef = db.collection('users').doc(user.uid);
        userRef.onSnapshot((doc) => {
            if (!doc.exists) {
                userRef.set({ email: user.email, credits: 10 });
            } else {
                const creds = doc.data().credits || 0;
                const badge = document.getElementById('credit-display');
                badge.innerText = `${creds} Credits`;
                badge.style.color = creds < 4 ? '#dc2626' : '#2563eb';
            }
        });

        // Initial Draw
        setTimeout(draw, 100);
    } else {
        document.getElementById('login-view').style.display = 'flex';
        document.getElementById('app-view').style.display = 'none';
    }
});

function handleLogin(e) {
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
