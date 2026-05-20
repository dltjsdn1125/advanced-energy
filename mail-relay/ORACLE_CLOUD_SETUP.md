# Oracle Cloud 춘천 — 무료 한국 IP 메일 백엔드 셋업 가이드

이 가이드는 **Oracle Cloud Always Free** VM을 한국(춘천) 리전에 띄워서, mail-relay 서비스를 호스팅하는 방법입니다. 평생 무료, 한국 IP, 다중 사용자 지원.

## 사전 준비

- 신용카드 1장 (인증용, 청구 발생 안 함 — Always Free 한도 안에서만 사용)
- 휴대폰 번호 (SMS 인증)
- Gmail/Naver 등 이메일 1개

소요 시간: 약 1시간 (계정 생성 + VM 셋업 + 배포)

---

## Step 1: Oracle Cloud 계정 만들기

1. https://www.oracle.com/cloud/sign-in.html 접속
2. "Create your account" 클릭
3. 정보 입력:
   - **Country**: South Korea
   - **Home Region**: **Chuncheon (춘천)** ← 반드시 이걸 선택!
   - 한 번 정하면 못 바꿈
4. 카드 인증 (1달러 가량 임시 결제 후 환불 — 실제 청구 X)
5. SMS 인증
6. 계정 활성화까지 5-30분 소요

---

## Step 2: VM 생성 (Always Free)

1. Oracle Cloud Console 로그인
2. 메뉴 → **Compute → Instances**
3. **Create Instance** 클릭
4. 설정:
   - **Name**: `ae-mail-relay`
   - **Compartment**: 기본
   - **Image**: Canonical Ubuntu 24.04 (Always Free Eligible)
   - **Shape**: **Ampere A1 Compute** (ARM, Always Free)
     - OCPU: 1
     - Memory: 6 GB
     - (필요시 4 OCPU + 24GB까지 무료 — 우리 용도엔 1 OCPU 충분)
   - **VCN**: 새로 생성 (기본값 사용)
   - **Public IPv4 address**: 할당
   - **SSH keys**: "Generate SSH key pair" 선택 → **개인키 파일 다운로드** (잘 보관!)
5. **Create** 클릭. 1-2분 후 RUNNING 상태가 됨.
6. Public IP 메모해 두기 (예: `132.226.123.45`)

---

## Step 3: 방화벽 + 보안 규칙 (포트 3000 열기)

mail-relay는 기본 3000번 포트로 실행됩니다. 외부 접속을 허용해야 합니다.

### 3-1) Oracle Console에서 Ingress Rule 추가

1. Console → **Virtual Cloud Networks** → 본인 VCN 클릭
2. **Subnet** → 본인 subnet 클릭 → **Default Security List** 클릭
3. **Add Ingress Rules** 클릭
4. 설정:
   - **Source CIDR**: `0.0.0.0/0`
   - **IP Protocol**: TCP
   - **Destination Port Range**: `3000` (또는 443 후술)
5. Add 클릭

### 3-2) VM 내부 방화벽도 열기 (Ubuntu)

다음 Step 4에서 SSH 접속 후 실행하면 됩니다:

```bash
sudo iptables -I INPUT -p tcp --dport 3000 -j ACCEPT
sudo netfilter-persistent save
```

---

## Step 4: SSH로 VM 접속

Windows에서 다운로드한 개인키(`ssh-key-XXXX.key`)로 접속:

```powershell
# PowerShell에서 (또는 Git Bash, WSL)
ssh -i "C:\Users\8x8\Downloads\ssh-key-XXXX.key" ubuntu@132.226.123.45
```

(IP는 본인 VM의 Public IP로 교체)

처음 접속 시 `yes` 입력.

---

## Step 5: Node.js + 우리 코드 배포

VM에 SSH 접속한 상태에서:

```bash
# Node.js 22 설치 (LTS)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git

# 프로젝트 클론
git clone https://github.com/dltjsdn1125/advanced-energy.git
cd advanced-energy/mail-relay

# 의존성 설치 + 빌드
npm install
npm run build

# 백그라운드 실행 (systemd 서비스로 등록)
sudo tee /etc/systemd/system/ae-mail-relay.service > /dev/null <<EOF
[Unit]
Description=AE Mail Relay
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/advanced-energy/mail-relay
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure
Environment="PORT=3000"
Environment="RELAY_REGION=ap-chuncheon-1"
Environment="ALLOWED_ORIGIN=https://advanced-energy.vercel.app"

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable ae-mail-relay
sudo systemctl start ae-mail-relay
sudo systemctl status ae-mail-relay
```

서비스가 `active (running)`이면 OK.

---

## Step 6: 동작 확인

본인 PC 브라우저에서:

```
http://132.226.123.45:3000/healthz
```

(IP는 본인 VM IP로 교체)

응답:
```json
{"ok":true,"ts":1740000000000,"region":"ap-chuncheon-1"}
```

---

## Step 7: Vercel 환경변수 설정

1. https://vercel.com/dashboard → advanced-energy 프로젝트
2. Settings → Environment Variables
3. 추가:
   - **Name**: `NEXT_PUBLIC_MAIL_RELAY`
   - **Value**: `http://132.226.123.45:3000`
     - (또는 도메인 + HTTPS 셋업하면 `https://relay.your-domain.com`)
   - **Environment**: Production, Preview
4. Save
5. Vercel 프로젝트 → **Deployments** → 최신 배포 우측 ... → **Redeploy**

배포 후 Vercel 앱의 메일 API 호출이 모두 Oracle Cloud(춘천 IP)를 거치게 됩니다.

---

## Step 8 (선택): HTTPS 설정

도메인이 있으시면 무료 SSL 인증서로 HTTPS 가능:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx

# Nginx 리버스 프록시 설정
sudo tee /etc/nginx/sites-available/mail-relay > /dev/null <<EOF
server {
    listen 80;
    server_name relay.your-domain.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/mail-relay /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx

# SSL 인증서 (Let's Encrypt 무료)
sudo certbot --nginx -d relay.your-domain.com
```

이후 Vercel 환경변수를 `https://relay.your-domain.com`으로 업데이트.

---

## 운영 / 트러블슈팅

### 로그 확인
```bash
sudo journalctl -u ae-mail-relay -f
```

### 재시작
```bash
sudo systemctl restart ae-mail-relay
```

### 코드 업데이트
```bash
cd /home/ubuntu/advanced-energy
git pull
cd mail-relay
npm install
npm run build
sudo systemctl restart ae-mail-relay
```

### IP가 mail.semigate.com에 차단된 것 같으면
호스팅 관리부에 Oracle Chuncheon 데이터센터 IP 대역 허용 요청 가능. 정 막히면 Oracle Console에서 VM에 **Reserved Public IP** 할당받으면 영구 IP 고정 가능.

---

## 비용

- VM (Ampere A1, 1 OCPU, 6GB): **무료, 평생**
- 대역폭 (10TB/월 outbound): 무료
- IP: 무료 (Reserved는 약간의 사용량 비용)
- 합계: **0원**

Always Free 한도를 넘어가면 VM이 일시 정지되지만, 자동 청구는 발생 안 함 (안심).
