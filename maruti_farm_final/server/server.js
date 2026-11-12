require("dotenv").config();
const express=require("express"),crypto=require("crypto"),Database=require("better-sqlite3"),path=require("path"),fs=require("fs");
const app=express(),PORT=process.env.PORT||3000;
const dataDir=path.join(__dirname,"data");fs.mkdirSync(dataDir,{recursive:true});const db=new Database(path.join(dataDir,"bookings.sqlite"));db.pragma("journal_mode=WAL");
db.exec(`CREATE TABLE IF NOT EXISTS bookings(id TEXT PRIMARY KEY,name TEXT NOT NULL,phone TEXT NOT NULL,start_date TEXT NOT NULL,end_date TEXT NOT NULL,days INTEGER NOT NULL,guests INTEGER NOT NULL,total_amount INTEGER NOT NULL,advance_amount INTEGER NOT NULL,order_id TEXT UNIQUE,payment_id TEXT UNIQUE,status TEXT NOT NULL,created_at TEXT NOT NULL);`);
app.use(express.json());app.use(express.static(path.join(__dirname,"..")));
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s));function addDays(s,n){const d=new Date(s+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
function expire(){db.prepare("UPDATE bookings SET status='expired' WHERE status='pending' AND created_at < ?").run(new Date(Date.now()-15*60*1000).toISOString())}
function conflict(start,end,exclude){expire();return !!db.prepare("SELECT id FROM bookings WHERE status IN ('pending','confirmed') AND start_date < ? AND end_date > ? AND (? IS NULL OR id != ?) LIMIT 1").get(end,start,exclude||null,exclude||null)}
function admin(req,res,next){if(!process.env.ADMIN_PASSWORD)return res.status(503).json({error:"Admin password is not configured on the server."});const supplied=Buffer.from(String(req.headers['x-admin-password']||'')),expected=Buffer.from(String(process.env.ADMIN_PASSWORD));if(supplied.length!==expected.length||!crypto.timingSafeEqual(supplied,expected))return res.status(401).json({error:"Incorrect admin password."});next()}
app.get('/api/availability',(req,res)=>{const n=Number(req.query.days),date=req.query.date;if(!validDate(date)||!Number.isInteger(n)||n<1||n>30)return res.status(400).json({error:'Invalid date or duration'});res.json({available:!conflict(date,addDays(date,n))})});
app.get('/api/admin/bookings',admin,(req,res)=>{const rows=db.prepare("SELECT id,name,phone,start_date,end_date,days,guests,total_amount,advance_amount,status,created_at FROM bookings ORDER BY created_at DESC LIMIT 500").all();res.json({bookings:rows})});
app.get('/health',(_,res)=>res.json({ok:true,service:'Maruti Farm booking server'}));app.listen(PORT,()=>console.log(`Maruti Farm server listening on ${PORT}`));
