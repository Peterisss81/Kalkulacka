from flask import Flask, render_template, jsonify, request
import json
import os

app = Flask(__name__)
DATA_FILE = "data.json"


def load_data():
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_data(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)


@app.route("/")
def index():
    data = load_data()
    return render_template("index.html", data=data)


@app.route("/save", methods=["POST"])
def save():
    data = request.json
    save_data(data)
    return jsonify({"status": "ok"})


@app.route("/save-json", methods=["POST"])
def save_json():
    try:
        data = request.json
        file_name = data.get("fileName", "kalkulacka") + ".json"
        content = data.get("content", {})

        # cesta ke složce, kde je app.py
        path = os.path.join(os.path.dirname(__file__), file_name)

        with open(path, "w", encoding="utf-8") as f:
            json.dump(content, f, ensure_ascii=False, indent=2)

        return jsonify({"status": "ok", "path": path})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})


@app.route("/load-json", methods=["POST"])
def load_json():
    try:
        if "file" not in request.files:
            return jsonify({"status": "error", "message": "Není soubor"})
        file = request.files["file"]

        content = json.load(file)  # načteme JSON
        return jsonify({"status": "ok", "content": content})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})


@app.route("/save-partial-json", methods=["POST"])
def save_partial_json():
    data = request.get_json()
    file_name = data.get("fileName", "export.json")
    content = data.get("content", {})

    # slozka pro parcialni exporty (vedle skriptu)
    #export_dir = os.path.join(os.path.dirname(__file__), "static", "exports")
    export_dir = os.path.join(os.path.dirname(__file__))
    os.makedirs(export_dir, exist_ok=True)

    # úplná cesta k souboru
    file_path = os.path.join(export_dir, file_name)

    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(content, f, ensure_ascii=False, indent=2)
        return jsonify({"status": "ok", "path": file_path})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})


from flask import Flask, request, jsonify
import json

@app.route("/load-partial-json", methods=["POST"])
def load_partial_json():
    if 'file' not in request.files:
        return jsonify({"status": "error", "message": "Soubor nebyl nahrán"}), 400

    file = request.files['file']

    try:
        content = json.load(file)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

    # 🔹 VRÁTÍME POUZE CELKY, JS si s nimi dále poradí
    return jsonify({
        "status": "ok",
        "content": content
    })

    


if __name__ == "__main__":
    app.run(port=8081,debug=False)
