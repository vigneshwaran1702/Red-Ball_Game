extends CharacterBody2D

# Simple enemy that patrols horizontally between two points
@export var speed: float = 150.0
@export var patrol_distance: float = 200.0

var _start_position: Vector2
var _direction: int = 1

func _ready() -> void:
    _start_position = position

func _physics_process(delta: float) -> void:
    var target_x = _start_position.x + _direction * patrol_distance
    if (_direction == 1 and position.x >= target_x) or (_direction == -1 and position.x <= target_x):
        _direction *= -1
    velocity.x = _direction * speed
    velocity.y = 0
    move_and_slide()
