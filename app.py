from flask import Flask, render_template, request, redirect, url_for, session
import mysql.connector
from functools import wraps

app = Flask(__name__)
app.secret_key = "innerglow_secret_key"

# ----------------- MySQL Connection -----------------
db = mysql.connector.connect(
    host="10.10.5.63",
    user="root",
    password="12345",
    port=3307,
    database="innerglow_db"
)
cursor = db.cursor(dictionary=True)

# ----------------- Login Required Decorator -----------------
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated_function

# ----------------- Routes -----------------

# Index Page (Public)
@app.route("/")
def index():
    return render_template("index.html", user=session.get("username"))

# Login Page
@app.route("/login", methods=["GET", "POST"])
def login():
    if "user_id" in session:
        return redirect(url_for("index"))
    error = None
    if request.method == "POST":
        email = request.form["email"]
        password = request.form["password"]
        cursor.execute("SELECT * FROM users WHERE email=%s AND password=%s", (email, password))
        user = cursor.fetchone()
        if user:
            session["user_id"] = user["id"]
            session["username"] = user["name"]
            return redirect(url_for("index"))
        error = "Invalid email or password"
    return render_template("login.html", error=error)

# Register Page
@app.route("/register", methods=["GET", "POST"])
def register():
    if "user_id" in session:
        return redirect(url_for("index"))
    error = None
    if request.method == "POST":
        name = request.form["name"]
        email = request.form["email"]
        password = request.form["password"]
        confirm_password = request.form["confirm_password"]

        if password != confirm_password:
            error = "Passwords do not match"
        else:
            # Check if email already exists
            cursor.execute("SELECT * FROM users WHERE email=%s", (email,))
            if cursor.fetchone():
                error = "Email already registered"
            else:
                cursor.execute(
                    "INSERT INTO users (name,email,password) VALUES (%s,%s,%s)",
                    (name, email, password)
                )
                db.commit()
                return redirect(url_for("login"))
    return render_template("register.html", error=error)

# Logout
@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))

# ----------------- Protected Pages -----------------
@app.route("/about_me")
@login_required
def about_me():
    return render_template("about_me.html", user=session.get("username"))

@app.route("/screening")
@login_required
def screening():
    return render_template("screening.html", user=session.get("username"))

@app.route("/track_progress")
@login_required
def track_progress():
    return render_template("track_progress.html", user=session.get("username"))

@app.route("/chat")
@login_required
def chat():
    return render_template("chat.html", user=session.get("username"))

@app.route("/appointments")
@login_required
def appointments():
    return render_template("appointments.html", user=session.get("username"))

@app.route("/resources")
@login_required
def resources():
    return render_template("resources.html", user=session.get("username"))

@app.route("/peer_support")
@login_required
def peer_support():
    return render_template("peer_support.html", user=session.get("username"))

# ----------------- Run App -----------------
if __name__ == "__main__":
    app.run(debug=True)
