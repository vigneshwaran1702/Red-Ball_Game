extends CharacterBody2D

@export var speed: float = 200.0

func _physics_process(delta: float) -> void:
    var input_vector := Vector2.ZERO
    if Input.is_action_pressed("ui_left"):
        input_vector.x -= 1
    if Input.is_action_pressed("ui_right"):
        input_vector.x += 1
    if Input.is_action_pressed("ui_up"):
        input_vector.y -= 1
    if Input.is_action_pressed("ui_down"):
        input_vector.y += 1
    if input_vector != Vector2.ZERO:
        input_vector = input_vector.normalized()
    velocity = input_vector * speed
    move_and_slide()
