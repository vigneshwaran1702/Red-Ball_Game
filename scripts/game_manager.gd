extends Node

# GameManager singleton to store global state like score and lives.

var score: int = 0
var lives: int = 3

func _ready() -> void:
    # Initialize any needed state
    pass

func add_score(amount: int) -> void:
    score += amount
    print("Score: %d" % score)

func reset() -> void:
    score = 0
    lives = 3
