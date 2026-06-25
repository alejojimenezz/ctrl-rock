from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route("/cotizar")
def cotizar():

    # Aquí irá tu scraping
    precio_final = 1680987

    return jsonify({
        "precio_final_cop": precio_final
    })

if __name__ == "__main__":
    app.run(port=5000, debug=True)