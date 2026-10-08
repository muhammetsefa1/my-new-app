# Assignment 2 – Adım Adım Komut Rehberi

Bu rehberi kendi bilgisayarında (Linux / WSL) çalıştır. Komutları **sırayla** kopyala-yapıştır.
Bilgiler bu rehbere işlendi:

| Bilgi             | Değer            |
|-------------------|------------------|
| NetID             | `muhammethundur` |
| GitHub kullanıcı adı | `muhammetsefa1` |
| Ödev reposu       | `https://github.com/muhammetsefa1/git-docker-assignment` |

> Komutlardaki `$NETID` ve `$GITHUB_USER`, kaydı başlattıktan sonra yapılan `export` satırlarıyla otomatik dolar.

---

## Hazırlık (kayıttan önce, bir kere)

1. GitHub'da **boş, public** bir repo oluştur: adı `git-docker-assignment`
   (README / .gitignore / license **ekleme**, tamamen boş olsun).
2. Git kimliğin ayarlı değilse:
   ```bash
   git config --global user.name "Adın Soyadın"
   git config --global user.email "github-mailin@ornek.com"
   ```
3. HTTPS ile push için GitHub şifresi değil **Personal Access Token** gerekir
   (veya SSH anahtarı kullan; o zaman remote URL'yi `git@github.com:muhammetsefa1/git-docker-assignment.git` yap).
4. Docker çalışıyor mu kontrol et: `docker info`

---

## Kaydı başlat

```bash
cd ~
script assignment_2_muhammethundur.txt
export NETID=muhammethundur
export GITHUB_USER=muhammetsefa1
```

> Ara verirsen: `exit` ile kaydı kapat, devam ederken `script -a assignment_2_muhammethundur.txt`.
> Transcript dosyası `~` içinde olduğu için repoya girmez (zaten `.gitignore` da `assignment_2_*.txt` dosyalarını hariç tutuyor).

---

## ===== CHECKPOINT 1 =====

```bash
echo "===== CHECKPOINT 1 ====="
echo "My GitHub repository: https://github.com/$GITHUB_USER/git-docker-assignment"

git clone --single-branch https://github.com/ComputingDemos/git-docker-starter.git
cd git-docker-starter

# Başlangıç reposunu upstream yap, kendi reponu origin olarak ekle
git remote rename origin upstream
git remote set-branches upstream '*'
git remote add origin https://github.com/$GITHUB_USER/git-docker-assignment.git

# main'i push et ve origin/main'i takip etmesini sağla
git push -u origin main

# Kanıtlar
git remote -v
git branch --show-current
git branch -vv
git status
git log --oneline --graph --decorate --all
```

> `--single-branch` + `set-branches '*'` sayesinde `upstream-update` dalı şimdi değil,
> Checkpoint 3'teki `git fetch upstream` sırasında **"[new branch]"** olarak gelir.
> Böylece "yeni alınan uzak bilgi" transcript'te açıkça görünür.

Beklenen: `git branch -vv` çıktısında `* main cf34847 [origin/main] ...`, `git status` çıktısında `nothing to commit, working tree clean`.

---

## ===== CHECKPOINT 2 =====

```bash
echo "===== CHECKPOINT 2 ====="
git switch -c feature/health-status
git branch --show-current
```

**app.py** — çıktıya durum satırını ekle:

```bash
sed -i "s|body = \"Advanced Git Docker App\\\\n\"|body = \"Advanced Git Docker App\\\\nStatus: healthy - $NETID\\\\n\"|" app.py
grep -n 'body =' app.py
```

Beklenen satır:
```python
        body = "Advanced Git Docker App\nStatus: healthy - muhammethundur\n"
```
(sed çalışmazsa `nano app.py` ile bu satırı elle böyle yaz.)

**Dockerfile** — yer tutucu satırı `RUN` ile değiştir:

```bash
sed -i 's|^# Add a RUN instruction here.*$|RUN mkdir -p /app/logs|' Dockerfile
cat Dockerfile
```

Beklenen Dockerfile:
```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY app.py .

RUN mkdir -p /app/logs

EXPOSE 8000

CMD ["python", "-u", "app.py"]
```

Commit'ler (her değişiklik kendi commit'inde) ve push + tracking tek komutta:

```bash
git diff
git add app.py
git commit -m "Add health status line with NetID to application output"
git add Dockerfile
git commit -m "Create /app/logs directory in Docker image"

git push -u origin feature/health-status
git branch -vv
git status
git log --oneline --graph --decorate --all
```

### Docker doğrulama

```bash
docker build -t git-docker-app:test .

docker images git-docker-app                                   # imaj var
docker run -d --name app-test -p 8080:8000 git-docker-app:test # 8080 -> 8000
sleep 2
docker ps                                                      # çalışan listede
docker port app-test                                           # 8000/tcp -> 0.0.0.0:8080
curl -i http://localhost:8080                                  # 200 OK + "Status: healthy - muhammethundur"
docker logs app-test                                           # loglar
docker inspect app-test                                        # konfigürasyon
docker inspect --format '{{.Name}} {{.Config.Image}} {{json .HostConfig.PortBindings}}' app-test

docker stop app-test                                           # durdur
docker ps -a --filter name=app-test                            # Exited
docker start app-test                                          # yeniden başlat
sleep 2
docker ps --filter name=app-test                               # Up
curl http://localhost:8080
docker logs app-test

docker stop app-test
docker rm app-test                                             # sil
docker ps -a --filter name=app-test                            # boş liste = artık yok
```

---

## ===== CHECKPOINT 3 =====

```bash
echo "===== CHECKPOINT 3 ====="
git switch main
git fetch upstream                     # "* [new branch] upstream-update -> upstream/upstream-update"

# Entegrasyondan önceki kanıtlar
git branch -r
git branch --show-current
git log --oneline --graph --decorate --all
git log --oneline main..upstream/upstream-update
git diff main upstream/upstream-update
```

Birleştirme (önce upstream, sonra feature). `--no-ff` ile her entegrasyon geçmişte bir merge commit olarak açıkça görünür:

```bash
git merge --no-ff upstream/upstream-update -m "Merge upstream/upstream-update into main"
git merge --no-ff feature/health-status -m "Merge branch 'feature/health-status' into main"

git log --oneline --graph --decorate --all
cat README.md          # upstream değişikliği ("## Verification") burada
cat app.py Dockerfile  # senin değişikliklerin burada

git push origin main

# Bitmiş feature dalını hem lokalde hem origin'de sil
git branch -d feature/health-status
git push origin --delete feature/health-status

git branch -a
git branch -vv
git status
```

Docker ile tekrar doğrula:

```bash
docker build -t git-docker-app:test .
docker run -d --name app-test -p 8080:8000 git-docker-app:test
sleep 2
docker ps --filter name=app-test
curl -i http://localhost:8080
docker stop app-test
docker rm app-test
docker ps -a --filter name=app-test
```

---

## ===== CHECKPOINT 4 =====

### Part A – Merge Conflict

```bash
echo "===== CHECKPOINT 4 - PART A ====="
git switch main
git branch title-version          # ikisi de aynı commit'ten
git branch title-edition
git log --oneline --graph --decorate --all -5

# 1. dal: başlığa sürüm numarası
git switch title-version
sed -i 's|Advanced Git Docker App\\n|Advanced Git Docker App v2.0\\n|' app.py
git diff
git commit -am "Add version number to application title"

# 2. dal: aynı satıra farklı değişiklik
git switch title-edition
sed -i 's|Advanced Git Docker App\\n|Advanced Git Docker App (Docker Edition)\\n|' app.py
git diff
git commit -am "Add edition name to application title"

# 1. dalı main'e birleştir
git switch main
git merge --no-ff title-version -m "Merge branch 'title-version' into main"

# 2. dalı birleştirmeyi dene -> CONFLICT
git merge title-edition
```

Beklenen çıktı:
```
Auto-merging app.py
CONFLICT (content): Merge conflict in app.py
Automatic merge failed; fix conflicts and then commit the result.
```

Çözmeden önceki kanıtlar:

```bash
git status                              # "both modified: app.py"
git diff --name-only --diff-filter=U    # çakışan dosya
cat app.py                              # <<<<<<< ======= >>>>>>> işaretleri
git diff                                # iki rakip değişiklik yan yana
```

Dosyada şunu göreceksin:
```
<<<<<<< HEAD
        body = "Advanced Git Docker App v2.0\nStatus: healthy - muhammethundur\n"
=======
        body = "Advanced Git Docker App (Docker Edition)\nStatus: healthy - muhammethundur\n"
>>>>>>> title-edition
```

**Elle çöz:** `nano app.py` aç, bu 5 satırı silip **ikisinin de niyetini koruyan** tek satır yaz:

```python
        body = "Advanced Git Docker App v2.0 (Docker Edition)\nStatus: healthy - muhammethundur\n"
```

(Girintiyi koru: 8 boşluk. Kaydet: `Ctrl+O`, `Enter`, çık: `Ctrl+X`.)

```bash
grep -n '<<<<<<<\|=======\|>>>>>>>' app.py || echo "No conflict markers left"
grep -n 'body =' app.py
git add app.py
git status
git commit -m "Merge branch 'title-edition' into main (keep both version and edition in title)"

git log --oneline --graph --decorate --all
git branch -d title-version title-edition

git push origin main
git status          # "Your branch is up to date with 'origin/main'."
git branch -vv
```

### Part B – Pull Request

~~~bash
echo "===== CHECKPOINT 4 - PART B ====="
git switch -c docs/usage

cat >> README.md <<'EOF'

## Usage

### Run with Docker

```
docker build -t git-docker-app:test .
docker run -d --name app-test -p 8080:8000 git-docker-app:test
curl http://localhost:8080
```

Expected output:

```
Advanced Git Docker App v2.0 (Docker Edition)
Status: healthy - <NetID>
```

Stop and remove the container when finished:

```
docker stop app-test
docker rm app-test
```

### Run without Docker

```
python3 app.py
curl http://localhost:8000
```
EOF

cat README.md
git diff
git add README.md
git commit -m "Add usage documentation to README"
git push -u origin docs/usage
~~~

**GitHub web sitesinde (zorunlu):**

1. `https://github.com/muhammetsefa1/git-docker-assignment` → çıkan **"Compare & pull request"** butonuna tıkla
   (yoksa *Pull requests → New pull request*, base: `main`, compare: `docs/usage`).
2. **Title:** `Add usage documentation to README`
3. **Description:** `Adds a Usage section explaining how to build, run, test and clean up the app with Docker, and how to run it without Docker.`
4. **Create pull request**.
5. **Files changed** sekmesine girip değişiklikleri incele.
6. **Conversation** sekmesine dön → **Merge pull request** → **Confirm merge**.
7. Çıkan **Delete branch** butonuna bas (uzak `docs/usage` silinir).

Terminale geri dön:

```bash
git switch main
git pull origin main          # PR merge commit'i gelir
git fetch --prune origin      # silinen origin/docs/usage referansını temizler
git branch -d docs/usage
git log --oneline --graph --decorate --all -8
git status
git branch -vv
```

> Web'de "Delete branch"e basmayı unuttuysan: `git push origin --delete docs/usage`

### Part C – Final Docker Verification

```bash
echo "===== CHECKPOINT 4 - PART C ====="
docker build -t git-docker-app:test .

docker network create app-net
docker network ls

docker run -d --name app-test --network app-net git-docker-app:test
sleep 2
docker ps --filter name=app-test
docker network inspect app-net

docker run --rm --name network-test --network app-net curlimages/curl:8.5.0 http://app-test:8000
```

Beklenen yanıt:
```
Advanced Git Docker App v2.0 (Docker Edition)
Status: healthy - muhammethundur
```

Temizlik:

```bash
docker stop app-test
docker rm app-test
docker ps -a --filter name=app-test        # boş
docker ps -a --filter name=network-test    # boş -> --rm ile otomatik silindi
docker network rm app-net
docker network ls                          # app-net yok
```

---

## ===== FINAL VERIFICATION =====

```bash
echo "===== FINAL VERIFICATION ====="
echo "My GitHub repository: https://github.com/$GITHUB_USER/git-docker-assignment"
git branch --show-current       # main
git status                      # working tree clean
git branch                      # kalan lokal dallar (sadece main)
git branch -r                   # kalan uzak dallar
git branch -vv                  # main -> [origin/main]
git remote -v                   # origin + upstream
ls -la
cat app.py
cat Dockerfile
cat README.md
git log --oneline --graph --decorate --all

exit                            # kaydı bitir
```

`~/assignment_2_muhammethundur.txt` dosyasını teslim et.

---

## Beklenen son commit grafiği (yaklaşık)

```
*   (HEAD -> main, origin/main) Merge pull request #1 from muhammetsefa1/docs/usage
|\
| * Add usage documentation to README
|/
*   Merge branch 'title-edition' into main (keep both version and edition in title)
|\
| * Add edition name to application title
* |   Merge branch 'title-version' into main
|\ \
| |/
|/|
| * Add version number to application title
|/
*   Merge branch 'feature/health-status' into main
|\
| * Create /app/logs directory in Docker image
| * Add health status line with NetID to application output
* |   Merge upstream/upstream-update into main
|\ \
| |/
|/|
| * (upstream/upstream-update) Document application verification
|/
* (upstream/main, upstream/HEAD) Add Dockerfile for Python application setup
* Implement HTTP server in app.py
* Add README for Git and Docker starter application
* Add .gitignore to exclude Python cache and assignment files
```

## Sık karşılaşılan sorunlar

- **`git push` şifre istiyor / reddediyor:** GitHub şifresi değil, Personal Access Token gir (veya SSH kullan).
- **`docker: permission denied`:** komutların başına `sudo` ekle ya da kullanıcını `docker` grubuna ekle.
- **`port is already allocated`:** önceki container duruyor; `docker rm -f app-test`.
- **`curl: (56) Recv failure`:** container yeni açıldı, 2 saniye bekleyip tekrar dene.
- **macOS kullanıyorsan:** `sed -i` yerine `sed -i ''` yaz; `script` komutu `script assignment_2_muhammethundur.txt` şeklinde aynı çalışır, devam etmek için `script -a assignment_2_muhammethundur.txt`.
