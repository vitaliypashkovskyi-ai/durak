"""Дурень — Telegram bot that opens the card game Mini App.

Standard library only, long polling (outgoing connections only, no open ports).

Settings (environment or .env next to this file):
    BOT_TOKEN   token from @BotFather (required)
    GAME_URL    HTTPS address of the game (default: GitHub Pages)

Run:  python bot.py          (python bot.py --test checks settings and exits)
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))


def load_env():
    path = os.path.join(HERE, ".env")
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


load_env()
TOKEN = os.environ.get("BOT_TOKEN", "").strip()
GAME_URL = os.environ.get("GAME_URL", "https://vitaliypashkovskyi-ai.github.io/durak/").strip()
API = f"https://api.telegram.org/bot{TOKEN}/"

WELCOME = (
    "🃏 <b>Дурень</b> — підкидний дурень проти бота.\n\n"
    "36 карт, козир, «Беру» і «Бито» — усе як за столом.\n"
    "Натисніть «Грати», щоб почати."
)
RULES = (
    "<b>Правила підкидного дурня</b>\n\n"
    "• 36 карт, по 6 у руці. Козир — нижня карта колоди.\n"
    "• <b>Атака:</b> киньте будь-яку карту, далі підкидайте номінали, що вже є на столі "
    "(до 6 карт і не більше, ніж карт у захисника).\n"
    "• <b>Захист:</b> бийте старшою картою тієї ж масті або козирем. Не можете — «Беру».\n"
    "• Відбилися — карти в «бито», ходить захисник.\n"
    "• Хто лишився з картами, коли колода скінчилась, — дурень."
)


def call(method, **params):
    data = json.dumps(params).encode("utf-8")
    req = urllib.request.Request(API + method, data=data, headers={"Content-Type": "application/json"})
    timeout = params.get("timeout", 0) + 15
    with urllib.request.urlopen(req, timeout=timeout) as r:
        res = json.loads(r.read().decode("utf-8"))
    if not res.get("ok"):
        raise RuntimeError(f"{method}: {res}")
    return res["result"]


def play_keyboard():
    return {"inline_keyboard": [[{"text": "🃏 Грати", "web_app": {"url": GAME_URL}}],
                                [{"text": "📜 Правила", "callback_data": "rules"}]]}


def setup():
    me = call("getMe")
    print(f"Bot @{me['username']} started, game: {GAME_URL}", flush=True)
    call("setMyCommands", commands=[
        {"command": "start", "description": "Почати"},
        {"command": "play", "description": "Грати в дурня"},
        {"command": "rules", "description": "Правила"},
    ])
    # The menu button next to the text field opens the game directly.
    call("setChatMenuButton", menu_button={"type": "web_app", "text": "Грати", "web_app": {"url": GAME_URL}})
    try:
        call("setMyShortDescription", short_description="Підкидний дурень проти бота прямо в Telegram 🃏")
    except Exception as e:  # not critical
        print("short description:", e, flush=True)


def handle(update):
    if "callback_query" in update:
        q = update["callback_query"]
        call("answerCallbackQuery", callback_query_id=q["id"])
        if q.get("data") == "rules" and q.get("message"):
            call("sendMessage", chat_id=q["message"]["chat"]["id"], text=RULES, parse_mode="HTML",
                 reply_markup=play_keyboard())
        return
    msg = update.get("message")
    if not msg or "text" not in msg:
        return
    chat = msg["chat"]
    cmd = msg["text"].split()[0].split("@")[0].lower()
    if chat["type"] != "private":
        # web_app buttons work only in private chats: send a link to the bot instead
        if cmd in ("/play", "/start"):
            call("sendMessage", chat_id=chat["id"], text="🃏 Грати в дурня — напишіть боту в особисті.",
                 reply_markup={"inline_keyboard": [[{"text": "Відкрити бота", "url": f"https://t.me/{BOT_NAME}?start=play"}]]})
        return
    if cmd == "/rules":
        call("sendMessage", chat_id=chat["id"], text=RULES, parse_mode="HTML", reply_markup=play_keyboard())
    else:
        call("sendMessage", chat_id=chat["id"], text=WELCOME, parse_mode="HTML", reply_markup=play_keyboard())


BOT_NAME = ""


def main():
    global BOT_NAME
    if not TOKEN:
        print("BOT_TOKEN is empty: put it into .env next to bot.py", flush=True)
        if "--test" in sys.argv:
            sys.exit(1)
        while True:  # keep the container alive so the log stays readable
            time.sleep(3600)
    if not GAME_URL.startswith("https://"):
        print("GAME_URL must be https://", flush=True)
        sys.exit(1)
    while True:
        try:
            setup()
            BOT_NAME = call("getMe")["username"]
            break
        except Exception as e:
            print("setup failed, retry in 30 s:", e, flush=True)
            time.sleep(30)
    if "--test" in sys.argv:
        print("OK", flush=True)
        return
    offset = 0
    while True:
        try:
            updates = call("getUpdates", offset=offset, timeout=50, allowed_updates=["message", "callback_query"])
        except Exception as e:
            print("getUpdates:", e, flush=True)
            time.sleep(5)
            continue
        for u in updates:
            offset = u["update_id"] + 1
            try:
                handle(u)
            except Exception as e:
                print("handle:", e, flush=True)


if __name__ == "__main__":
    main()
