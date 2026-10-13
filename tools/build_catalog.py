"""Build data/exercises.json: the exercise catalog Lineup ships with.

Source of names, instructions and photos: free-exercise-db (https://github.com/yuhonas/free-exercise-db),
a public-domain (Unlicense) set of 870+ exercises. That set only knows 17 broad muscle groups ("shoulders",
"chest"), which is too coarse to plan with, so this file keeps the lifts that matter for building muscle and
maps each one by hand onto Lineup's finer zones (front / side / rear delts, upper vs mid-lower chest,
triceps long head vs lateral, ...). Photos are not copied: the app loads them from GitHub when you open an
exercise.

The lifts in EXERCISES below are mapped by hand. Every other strength lift in the source set is brought in
too, with its muscles worked out by rule from the source's 17 groups and the lift's name (see auto_zones).
Those carry "auto": 1, and the app marks them as auto-mapped so you know nobody has checked them. To promote
one, add a row for it to EXERCISES: a hand-mapped row always wins.

Run:  python tools/build_catalog.py           (downloads the source set to tools/cache/ the first time)

To add a lift: add a row to EXERCISES below. First column is the free-exercise-db id (the folder name in that
repo), or None for one that isn't in it. Zones use the short codes in Z.
"""
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "tools" / "cache" / "free-exercise-db.json"
SOURCE_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json"
IMAGE_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/"

# ---- muscle zones (these ids are what data/body.json paints) ----
GROUPS = ["Chest", "Shoulders", "Back", "Arms", "Core", "Legs"]
MUSCLES = [
    # id, name, short name, group
    ("chest_upper", "Upper chest", "Upper chest", "Chest"),
    ("chest_lower", "Mid & lower chest", "Mid chest", "Chest"),
    ("delt_front", "Front delts", "Front delts", "Shoulders"),
    ("delt_side", "Side delts", "Side delts", "Shoulders"),
    ("delt_rear", "Rear delts", "Rear delts", "Shoulders"),
    ("traps_upper", "Upper traps", "Upper traps", "Back"),
    ("mid_back", "Mid back", "Mid back", "Back"),
    ("lats", "Lats", "Lats", "Back"),
    ("lower_back", "Lower back", "Lower back", "Back"),
    ("biceps", "Biceps", "Biceps", "Arms"),
    ("tri_long", "Triceps · long head", "Tri long head", "Arms"),
    ("tri_lat", "Triceps · lateral & medial", "Tri lateral", "Arms"),
    ("forearms", "Forearms", "Forearms", "Arms"),
    ("abs", "Abs", "Abs", "Core"),
    ("obliques", "Obliques", "Obliques", "Core"),
    ("neck", "Neck", "Neck", "Core"),
    ("glutes", "Glutes", "Glutes", "Legs"),
    ("glute_med", "Glute med (abductors)", "Glute med", "Legs"),
    ("quads", "Quads", "Quads", "Legs"),
    ("hamstrings", "Hamstrings", "Hamstrings", "Legs"),
    ("adductors", "Adductors", "Adductors", "Legs"),
    ("calves", "Calves", "Calves", "Legs"),
    ("tibialis", "Tibialis", "Tibialis", "Legs"),
]
MUSCLE_NOTES = {
    "mid_back": "Mid and lower traps, rhomboids and the muscles on the shoulder blade.",
    "lats": "Lats and teres major.",
    "chest_upper": "The clavicular head: the band under the collarbone.",
    "chest_lower": "The sternal and costal heads: the bulk of the chest.",
    "tri_long": "The head that crosses the shoulder; overhead work stretches it most.",
    "tri_lat": "The two heads that only cross the elbow; presses and pushdowns.",
    "glute_med": "Glute medius and minimus: the side of the hip.",
    "lower_back": "Spinal erectors.",
}

Z = {
    "cu": "chest_upper", "cl": "chest_lower", "df": "delt_front", "ds": "delt_side", "dr": "delt_rear",
    "tu": "traps_upper", "mb": "mid_back", "la": "lats", "lb": "lower_back",
    "bi": "biceps", "tl": "tri_long", "tx": "tri_lat", "fa": "forearms",
    "ab": "abs", "ob": "obliques", "nk": "neck",
    "gl": "glutes", "gm": "glute_med", "qu": "quads", "ha": "hamstrings", "ad": "adductors", "ca": "calves", "ti": "tibialis",
}

BB, DB, CB, MC, BW, OT = "barbell", "dumbbell", "cable", "machine", "bodyweight", "other"
KB, BD = "kettlebell", "band"
PUSH, PULL, LEGS, CORE = "push", "pull", "legs", "core"

# (source id | None, name, equipment, kind, primary zones, secondary zones, extra search words)
# Primary = the lift is a direct set for that zone (counts 1). Secondary = it helps (counts 0.5).
EXERCISES = [
    # ---------------- chest ----------------
    ("Barbell_Bench_Press_-_Medium_Grip", "Barbell Bench Press", BB, PUSH, "cl", "cu df tx", "flat bench"),
    ("Barbell_Incline_Bench_Press_-_Medium_Grip", "Incline Barbell Press", BB, PUSH, "cu", "cl df tx", "incline bench"),
    ("Decline_Barbell_Bench_Press", "Decline Barbell Press", BB, PUSH, "cl", "df tx", ""),
    ("Dumbbell_Bench_Press", "Dumbbell Bench Press", DB, PUSH, "cl", "cu df tx", "flat db press"),
    ("Incline_Dumbbell_Press", "Incline Dumbbell Press", DB, PUSH, "cu", "cl df tx", "incline db press"),
    ("Decline_Dumbbell_Bench_Press", "Decline Dumbbell Press", DB, PUSH, "cl", "df tx", ""),
    ("Smith_Machine_Bench_Press", "Smith Machine Bench Press", MC, PUSH, "cl", "cu df tx", "smith flat"),
    ("Smith_Machine_Incline_Bench_Press", "Smith Machine Incline Press", MC, PUSH, "cu", "cl df tx", "smith incline"),
    ("Machine_Bench_Press", "Machine Chest Press", MC, PUSH, "cl", "cu df tx", "seated chest press"),
    ("Leverage_Incline_Chest_Press", "Incline Machine Press", MC, PUSH, "cu", "cl df tx", "hammer strength incline plate loaded"),
    ("Leverage_Chest_Press", "Plate-Loaded Chest Press", MC, PUSH, "cl", "cu df tx", "hammer strength"),
    ("Cable_Chest_Press", "Cable Chest Press", CB, PUSH, "cl", "cu df tx", ""),
    ("Butterfly", "Pec Deck", MC, PUSH, "cl", "cu df", "machine fly butterfly"),
    ("Dumbbell_Flyes", "Dumbbell Fly", DB, PUSH, "cl", "cu df", "flye"),
    ("Incline_Dumbbell_Flyes", "Incline Dumbbell Fly", DB, PUSH, "cu", "cl df", "flye"),
    ("Cable_Crossover", "Cable Crossover (high to low)", CB, PUSH, "cl", "df", "cable fly"),
    ("Low_Cable_Crossover", "Low-to-High Cable Fly", CB, PUSH, "cu", "cl df", "low cable crossover"),
    ("Flat_Bench_Cable_Flyes", "Cable Fly on a Bench", CB, PUSH, "cl", "cu df", "flye"),
    ("Incline_Cable_Flye", "Incline Cable Fly", CB, PUSH, "cu", "cl df", "flye"),
    ("Pushups", "Push-Up", BW, PUSH, "cl", "cu df tx", "pushup press up"),
    ("Decline_Push-Up", "Feet-Elevated Push-Up", BW, PUSH, "cu", "cl df tx", "decline pushup"),
    ("Dips_-_Chest_Version", "Chest Dip", BW, PUSH, "cl", "df tx", "dips"),
    # ---------------- shoulders ----------------
    ("Standing_Military_Press", "Overhead Press", BB, PUSH, "df", "ds tx cu", "ohp military standing barbell press"),
    ("Seated_Barbell_Military_Press", "Seated Barbell Press", BB, PUSH, "df", "ds tx cu", "military"),
    ("Seated_Dumbbell_Press", "Seated Dumbbell Press", DB, PUSH, "df", "ds tx", "shoulder press"),
    ("Standing_Dumbbell_Press", "Standing Dumbbell Press", DB, PUSH, "df", "ds tx", "shoulder press"),
    ("Arnold_Dumbbell_Press", "Arnold Press", DB, PUSH, "df", "ds tx", ""),
    ("Machine_Shoulder_Military_Press", "Machine Shoulder Press", MC, PUSH, "df", "ds tx", ""),
    ("Smith_Machine_Overhead_Shoulder_Press", "Smith Machine Shoulder Press", MC, PUSH, "df", "ds tx", ""),
    ("Side_Lateral_Raise", "Dumbbell Lateral Raise", DB, PUSH, "ds", "tu", "side raise laterals"),
    ("Standing_Low-Pulley_Deltoid_Raise", "Cable Lateral Raise", CB, PUSH, "ds", "tu", "side raise"),
    (None, "Machine Lateral Raise", MC, PUSH, "ds", "tu", "side raise"),
    ("One-Arm_Incline_Lateral_Raise", "Incline Lateral Raise", DB, PUSH, "ds", "", "lying side raise"),
    ("Front_Dumbbell_Raise", "Front Raise", DB, PUSH, "df", "cu ds", ""),
    ("Upright_Barbell_Row", "Upright Row", BB, PULL, "ds", "tu df bi", ""),
    ("Reverse_Flyes", "Rear Delt Fly (dumbbell)", DB, PULL, "dr", "mb", "reverse fly bent over raise"),
    ("Reverse_Machine_Flyes", "Reverse Pec Deck", MC, PULL, "dr", "mb", "rear delt machine fly"),
    ("Cable_Rear_Delt_Fly", "Cable Rear Delt Fly", CB, PULL, "dr", "mb", "reverse cable crossover"),
    ("Face_Pull", "Face Pull", CB, PULL, "dr", "mb tu", ""),
    # ---------------- back ----------------
    ("Pullups", "Pull-Up", BW, PULL, "la", "bi mb dr fa", "pullup"),
    ("Chin-Up", "Chin-Up", BW, PULL, "la", "bi mb fa", "chinup"),
    ("Wide-Grip_Lat_Pulldown", "Lat Pulldown (wide grip)", CB, PULL, "la", "bi mb dr", ""),
    ("Close-Grip_Front_Lat_Pulldown", "Lat Pulldown (close grip)", CB, PULL, "la", "bi mb", ""),
    ("V-Bar_Pulldown", "Neutral-Grip Pulldown", CB, PULL, "la", "bi mb", "v-bar mag grip"),
    ("Underhand_Cable_Pulldowns", "Underhand Pulldown", CB, PULL, "la", "bi mb", "supinated reverse grip"),
    ("One_Arm_Lat_Pulldown", "Single-Arm Pulldown", CB, PULL, "la", "bi", "one arm unilateral"),
    ("Straight-Arm_Pulldown", "Straight-Arm Pulldown", CB, PULL, "la", "tl", "lat prayer pullover"),
    ("Straight-Arm_Dumbbell_Pullover", "Dumbbell Pullover", DB, PULL, "la", "cl tl", ""),
    ("Bent_Over_Barbell_Row", "Barbell Row", BB, PULL, "mb la", "dr bi lb", "bent over row"),
    ("One-Arm_Dumbbell_Row", "Dumbbell Row", DB, PULL, "la", "mb dr bi", "one arm single"),
    ("Seated_Cable_Rows", "Seated Cable Row", CB, PULL, "mb la", "dr bi", "low row"),
    ("Seated_One-arm_Cable_Pulley_Rows", "Single-Arm Cable Row", CB, PULL, "la", "mb dr bi", "one arm"),
    ("T-Bar_Row_with_Handle", "T-Bar Row", BB, PULL, "mb la", "dr bi lb", "landmine row"),
    ("Lying_T-Bar_Row", "Chest-Supported T-Bar Row", MC, PULL, "mb", "la dr bi", ""),
    ("Dumbbell_Incline_Row", "Chest-Supported Dumbbell Row", DB, PULL, "mb", "la dr bi", "incline bench row"),
    (None, "Chest-Supported Machine Row", MC, PULL, "mb", "la dr bi", "seated row machine"),
    ("Leverage_Iso_Row", "Plate-Loaded Row", MC, PULL, "mb la", "dr bi", "hammer strength iso row"),
    ("Leverage_High_Row", "High Row (machine)", MC, PULL, "la", "mb dr bi", "hammer strength"),
    ("Inverted_Row", "Inverted Row", BW, PULL, "mb", "la dr bi", "bodyweight row"),
    ("Barbell_Shrug", "Barbell Shrug", BB, PULL, "tu", "fa", ""),
    ("Dumbbell_Shrug", "Dumbbell Shrug", DB, PULL, "tu", "fa", ""),
    ("Hyperextensions_Back_Extensions", "Back Extension", BW, PULL, "lb", "gl ha", "hyperextension 45 degree"),
    ("Barbell_Deadlift", "Deadlift", BB, LEGS, "gl ha lb", "qu tu mb fa", "conventional"),
    ("Rack_Pulls", "Rack Pull", BB, PULL, "lb", "gl ha tu fa", ""),
    # ---------------- arms: biceps ----------------
    ("Barbell_Curl", "Barbell Curl", BB, PULL, "bi", "fa", ""),
    ("EZ-Bar_Curl", "EZ-Bar Curl", BB, PULL, "bi", "fa", ""),
    ("Dumbbell_Bicep_Curl", "Dumbbell Curl", DB, PULL, "bi", "fa", ""),
    ("Incline_Dumbbell_Curl", "Incline Dumbbell Curl", DB, PULL, "bi", "fa", ""),
    ("Hammer_Curls", "Hammer Curl", DB, PULL, "bi fa", "", "brachialis brachioradialis"),
    ("Cable_Hammer_Curls_-_Rope_Attachment", "Rope Hammer Curl", CB, PULL, "bi fa", "", ""),
    ("Preacher_Curl", "Preacher Curl", BB, PULL, "bi", "fa", ""),
    ("Machine_Preacher_Curls", "Machine Preacher Curl", MC, PULL, "bi", "", ""),
    ("Machine_Bicep_Curl", "Machine Curl", MC, PULL, "bi", "", ""),
    ("Standing_Biceps_Cable_Curl", "Cable Curl", CB, PULL, "bi", "fa", ""),
    (None, "Bayesian Cable Curl", CB, PULL, "bi", "fa", "behind the body cable curl"),
    ("Concentration_Curls", "Concentration Curl", DB, PULL, "bi", "", ""),
    ("Spider_Curl", "Spider Curl", BB, PULL, "bi", "", ""),
    ("Reverse_Barbell_Curl", "Reverse Curl", BB, PULL, "fa", "bi", "brachioradialis"),
    # ---------------- arms: triceps ----------------
    ("Triceps_Pushdown", "Triceps Pushdown (bar)", CB, PUSH, "tx", "tl", "pressdown"),
    ("Triceps_Pushdown_-_Rope_Attachment", "Rope Pushdown", CB, PUSH, "tx", "tl", "pressdown"),
    ("Cable_One_Arm_Tricep_Extension", "Single-Arm Pushdown", CB, PUSH, "tx", "tl", "one arm"),
    (None, "Cross-Body Cable Extension", CB, PUSH, "tx", "tl", "triceps cross cable"),
    ("Cable_Rope_Overhead_Triceps_Extension", "Overhead Cable Extension", CB, PUSH, "tl", "tx", "rope overhead triceps"),
    ("Standing_Dumbbell_Triceps_Extension", "Overhead Dumbbell Extension", DB, PUSH, "tl", "tx", "french press"),
    ("EZ-Bar_Skullcrusher", "Skullcrusher (EZ bar)", BB, PUSH, "tl tx", "", "lying triceps extension"),
    ("Lying_Dumbbell_Tricep_Extension", "Dumbbell Skullcrusher", DB, PUSH, "tl tx", "", "lying triceps extension"),
    ("Machine_Triceps_Extension", "Machine Triceps Extension", MC, PUSH, "tx", "tl", ""),
    ("Tricep_Dumbbell_Kickback", "Triceps Kickback", DB, PUSH, "tx", "tl", ""),
    ("Close-Grip_Barbell_Bench_Press", "Close-Grip Bench Press", BB, PUSH, "tx", "cl df", "cgbp"),
    ("Dips_-_Triceps_Version", "Triceps Dip", BW, PUSH, "tx", "cl df tl", "dips"),
    ("Dip_Machine", "Machine Dip", MC, PUSH, "tx", "cl df", "seated dip"),
    ("Bench_Dips", "Bench Dip", BW, PUSH, "tx", "df cl", ""),
    ("Push-Ups_-_Close_Triceps_Position", "Close-Grip Push-Up", BW, PUSH, "tx", "cl df", "diamond pushup"),
    # ---------------- arms: forearms ----------------
    ("Palms-Up_Barbell_Wrist_Curl_Over_A_Bench", "Wrist Curl", BB, PULL, "fa", "", "forearm flexors"),
    ("Palms-Down_Wrist_Curl_Over_A_Bench", "Reverse Wrist Curl", BB, PULL, "fa", "", "wrist extension"),
    ("Farmers_Walk", "Farmer's Carry", OT, PULL, "fa tu", "ab", "farmers walk grip"),
    # ---------------- core ----------------
    ("Cable_Crunch", "Cable Crunch", CB, CORE, "ab", "ob", "kneeling rope crunch"),
    ("Ab_Crunch_Machine", "Machine Crunch", MC, CORE, "ab", "", ""),
    ("Crunches", "Crunch", BW, CORE, "ab", "", ""),
    ("Decline_Crunch", "Decline Crunch", BW, CORE, "ab", "", "sit-up"),
    ("Hanging_Leg_Raise", "Hanging Leg Raise", BW, CORE, "ab", "ob", ""),
    ("Knee_Hip_Raise_On_Parallel_Bars", "Captain's Chair Knee Raise", BW, CORE, "ab", "ob", "vertical knee raise"),
    ("Reverse_Crunch", "Reverse Crunch", BW, CORE, "ab", "", ""),
    ("Ab_Roller", "Ab Wheel Rollout", OT, CORE, "ab", "ob la", "roller"),
    ("Plank", "Plank", BW, CORE, "ab", "ob", ""),
    ("Side_Bridge", "Side Plank", BW, CORE, "ob", "gm", "side bridge"),
    ("Russian_Twist", "Russian Twist", BW, CORE, "ob", "ab", ""),
    ("Standing_Cable_Wood_Chop", "Cable Woodchop", CB, CORE, "ob", "ab", ""),
    ("Pallof_Press", "Pallof Press", CB, CORE, "ob", "ab", "anti-rotation"),
    ("Dumbbell_Side_Bend", "Dumbbell Side Bend", DB, CORE, "ob", "", ""),
    ("Lying_Face_Up_Plate_Neck_Resistance", "Neck Curl (plate)", OT, CORE, "nk", "", "neck flexion"),
    ("Lying_Face_Down_Plate_Neck_Resistance", "Neck Extension (plate)", OT, CORE, "nk", "tu", ""),
    # ---------------- legs: quads ----------------
    ("Barbell_Squat", "Back Squat", BB, LEGS, "qu gl", "ad lb", "barbell squat"),
    ("Front_Barbell_Squat", "Front Squat", BB, LEGS, "qu", "gl ad lb", ""),
    ("Smith_Machine_Squat", "Smith Machine Squat", MC, LEGS, "qu gl", "ad", ""),
    ("Hack_Squat", "Hack Squat", MC, LEGS, "qu", "gl ad", "machine hack"),
    (None, "Pendulum Squat", MC, LEGS, "qu", "gl ad", ""),
    ("Leg_Press", "Leg Press", MC, LEGS, "qu", "gl ad", ""),
    ("Leg_Extensions", "Leg Extension", MC, LEGS, "qu", "", "rectus femoris"),
    ("Goblet_Squat", "Goblet Squat", DB, LEGS, "qu", "gl ad", ""),
    ("Split_Squat_with_Dumbbells", "Bulgarian Split Squat", DB, LEGS, "qu gl", "ad ha", "rear foot elevated rfess"),
    ("Dumbbell_Lunges", "Dumbbell Lunge", DB, LEGS, "qu gl", "ad ha", ""),
    ("Barbell_Walking_Lunge", "Walking Lunge", BB, LEGS, "qu gl", "ad ha", ""),
    ("Dumbbell_Step_Ups", "Step-Up", DB, LEGS, "qu gl", "ha", ""),
    ("Weighted_Sissy_Squat", "Sissy Squat", BW, LEGS, "qu", "", ""),
    ("Trap_Bar_Deadlift", "Trap Bar Deadlift", OT, LEGS, "qu gl", "ha lb tu fa", "hex bar"),
    # ---------------- legs: hamstrings & glutes ----------------
    ("Romanian_Deadlift", "Romanian Deadlift", BB, LEGS, "ha gl", "lb ad fa", "rdl"),
    ("Stiff-Legged_Dumbbell_Deadlift", "Dumbbell Romanian Deadlift", DB, LEGS, "ha gl", "lb", "rdl stiff leg"),
    ("Stiff-Legged_Barbell_Deadlift", "Stiff-Leg Deadlift", BB, LEGS, "ha", "gl lb", "sldl"),
    ("Good_Morning", "Good Morning", BB, LEGS, "ha", "gl lb", ""),
    ("Seated_Leg_Curl", "Seated Leg Curl", MC, LEGS, "ha", "ca", "hamstring curl"),
    ("Lying_Leg_Curls", "Lying Leg Curl", MC, LEGS, "ha", "ca", "hamstring curl prone"),
    ("Standing_Leg_Curl", "Standing Leg Curl", MC, LEGS, "ha", "ca", "single leg curl"),
    ("Glute_Ham_Raise", "Glute-Ham Raise", MC, LEGS, "ha", "gl ca", "ghr"),
    ("Natural_Glute_Ham_Raise", "Nordic Curl", BW, LEGS, "ha", "", "nordic hamstring"),
    ("Sumo_Deadlift", "Sumo Deadlift", BB, LEGS, "gl ad", "qu ha lb tu fa", ""),
    ("Barbell_Hip_Thrust", "Hip Thrust", BB, LEGS, "gl", "ha", ""),
    ("Barbell_Glute_Bridge", "Glute Bridge", BB, LEGS, "gl", "ha", ""),
    ("One-Legged_Cable_Kickback", "Cable Glute Kickback", CB, LEGS, "gl", "ha", ""),
    ("Pull_Through", "Cable Pull-Through", CB, LEGS, "gl", "ha lb", ""),
    ("Reverse_Hyperextension", "Reverse Hyper", MC, LEGS, "gl", "ha lb", ""),
    ("Thigh_Abductor", "Hip Abduction (machine)", MC, LEGS, "gm", "gl", "abductor"),
    ("Thigh_Adductor", "Hip Adduction (machine)", MC, LEGS, "ad", "", "adductor"),
    # ---------------- legs: lower leg ----------------
    ("Standing_Calf_Raises", "Standing Calf Raise", MC, LEGS, "ca", "", "gastrocnemius"),
    ("Seated_Calf_Raise", "Seated Calf Raise", MC, LEGS, "ca", "", "soleus"),
    ("Calf_Press_On_The_Leg_Press_Machine", "Leg Press Calf Raise", MC, LEGS, "ca", "", "calf press"),
    ("Standing_Dumbbell_Calf_Raise", "Dumbbell Calf Raise", DB, LEGS, "ca", "", "single leg"),
    (None, "Tibialis Raise", BW, LEGS, "ti", "", "tib raise shin"),
]

# Short how-tos for the lifts that aren't in the source set.
OWN_HOWTO = {
    "Machine Lateral Raise": [
        "Set the seat so the pivot lines up with your shoulder joint, forearms or upper arms against the pads.",
        "Raise your arms out to the sides until they're about level with your shoulders, leading with the elbows.",
        "Lower under control to the bottom without letting the stack rest.",
    ],
    "Chest-Supported Machine Row": [
        "Set the chest pad so you can just reach the handles with your arms straight and shoulder blades spread.",
        "Row by driving the elbows back and squeezing the shoulder blades together; keep your chest on the pad.",
        "Return until the arms are straight and the shoulder blades are stretched forward.",
    ],
    "Bayesian Cable Curl": [
        "Set a cable low, face away from it and step forward so the working arm sits slightly behind your body.",
        "Curl the handle up without letting the elbow drift forward.",
        "Lower until the arm is straight and the biceps are stretched behind you.",
    ],
    "Cross-Body Cable Extension": [
        "Set two cables at about head height (or use one at a time). Take the left cable in your right hand and vice versa, without handles if you can.",
        "With the upper arms pinned at your sides, extend the elbows down and out until the arms are straight.",
        "Let the hands travel back across the body on the way up.",
    ],
    "Pendulum Squat": [
        "Stand on the platform with your shoulders under the pads and feet about shoulder width.",
        "Unlock, then sit straight down as deep as your hips allow while keeping your heels down.",
        "Drive back up without locking the knees hard at the top.",
    ],
    "Tibialis Raise": [
        "Lean your back against a wall with your feet a step or two in front of you, legs straight.",
        "Pull your toes up toward your shins as high as they go, heels staying on the floor.",
        "Lower slowly. Step the feet further out to make it harder, or use a tib bar for load.",
    ],
}

# ---------- everything else in the source set, mapped by rule ----------
AUTO_CATEGORIES = ("strength", "powerlifting", "olympic weightlifting", "strongman")   # not stretching, cardio, plyometrics
EQ_FROM_SOURCE = {"barbell": BB, "e-z curl bar": BB, "dumbbell": DB, "cable": CB, "machine": MC, "body only": BW,
                  "kettlebells": KB, "bands": BD}
KIND_FROM_GROUP = {"chest": PUSH, "shoulders": PUSH, "triceps": PUSH, "abdominals": CORE, "neck": CORE,
                   "quadriceps": LEGS, "hamstrings": LEGS, "glutes": LEGS, "calves": LEGS, "adductors": LEGS, "abductors": LEGS}
ONE_TO_ONE = {"lats": "lats", "middle back": "mid_back", "lower back": "lower_back", "traps": "traps_upper", "biceps": "biceps",
              "forearms": "forearms", "quadriceps": "quads", "hamstrings": "hamstrings", "glutes": "glutes", "calves": "calves",
              "adductors": "adductors", "abductors": "glute_med", "neck": "neck"}


def auto_zones(e):
    """Direct and helped zones for a source lift, from its broad muscle groups and its name. A best guess."""
    name = e["name"].lower()
    has = lambda *words: any(w in name for w in words)
    prim, sec = e.get("primaryMuscles") or [], e.get("secondaryMuscles") or []
    compound = e.get("mechanic") == "compound"
    pulling = bool(set(prim) & {"lats", "middle back", "biceps", "traps"})
    squatting = "quadriceps" in prim and has("squat", "leg press", "hack")
    p, s = [], []

    def add(to, *zones):
        for z in zones:
            if z not in p and z not in s:
                to.append(z)

    for m in prim:
        if m == "chest":
            pushup = has("push-up", "pushup", "push up")
            if (has("incline") and not pushup) or (pushup and has("decline", "feet elevated")) or has("low cable crossover"):
                add(p, "chest_upper"); add(s, "chest_lower")       # an incline press, or a push-up with the feet up
            elif has("decline") or (pushup and has("incline")):
                add(p, "chest_lower")
            else:
                add(p, "chest_lower"); add(s, "chest_upper")
        elif m == "shoulders":
            if has("rear", "reverse fl", "face pull", "external rotation", "bent over", "bent-over", "row to neck"):
                add(p, "delt_rear")
            elif has("lateral", "side", "upright", "scaption"):
                add(p, "delt_side")
            elif has("front", "raise") and not has("press"):
                add(p, "delt_front")
            else:                                                  # presses and anything unrecognised
                add(p, "delt_front"); add(s, "delt_side")
        elif m == "triceps":
            if has("overhead", "behind the head", "seated triceps press", "standing dumbbell triceps", "incline") and not has("push-up", "pushup"):
                add(p, "tri_long"); add(s, "tri_lat")
            elif has("skull", "lying", "decline") and not compound:
                add(p, "tri_long", "tri_lat")
            elif compound:                                         # dips and close-grip presses
                add(p, "tri_lat")
            else:
                add(p, "tri_lat"); add(s, "tri_long")
        elif m == "abdominals":
            if has("oblique", "twist", "side bend", "side bridge", "side jack", "wood chop", "russian", "pallof", "landmine 180", "judo"):
                add(p, "obliques"); add(s, "abs")
            else:
                add(p, "abs")
        elif m == "biceps":
            add(p, "biceps")
            if has("hammer", "reverse", "zottman"):
                add(p, "forearms")
        elif m in ONE_TO_ONE:
            add(p, ONE_TO_ONE[m])
    for m in sec:
        if m == "calves":
            continue                                               # listed for most leg lifts; they only stabilise
        if m == "hamstrings" and squatting:
            continue                                               # squats and leg presses don't grow them (Kubo 2019)
        if m == "chest":
            add(s, "chest_lower")
        elif m == "shoulders":
            add(s, "delt_rear" if pulling else "delt_front")
        elif m == "triceps":
            add(s, "tri_lat")
        elif m == "abdominals":
            add(s, "abs")
        elif m in ONE_TO_ONE:
            add(s, ONE_TO_ONE[m])
    if squatting:
        add(s, "adductors")
    return p, s


def load_source():
    if not CACHE.exists():
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        print("downloading", SOURCE_URL)
        req = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "lineup/0.1 (personal lift planner)"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            CACHE.write_bytes(resp.read())
    return {e["id"]: e for e in json.loads(CACHE.read_text(encoding="utf-8"))}


def slug(name: str) -> str:
    out = "".join(c.lower() if c.isalnum() else "_" for c in name)
    while "__" in out:
        out = out.replace("__", "_")
    return out.strip("_")


def build():
    src = load_source()
    muscle_ids = {m[0] for m in MUSCLES}
    group_of = {m[0]: m[3] for m in MUSCLES}
    out, seen, problems = [], set(), []
    for sid, name, eq, kind, prim, sec, words in EXERCISES:
        p = [Z[c] for c in prim.split()]
        s = [Z[c] for c in sec.split()]
        if set(p) & set(s):
            problems.append(f"{name}: a zone is both primary and secondary")
        if not p or not set(p + s) <= muscle_ids:
            problems.append(f"{name}: bad zones")
        ex = {"id": sid or "lb_" + slug(name), "name": name, "eq": eq, "kind": kind, "p": p, "s": s, "group": group_of[p[0]]}
        if sid:
            e = src.get(sid)
            if not e:
                problems.append(f"{name}: no '{sid}' in the source set")
                continue
            ex["mech"] = e.get("mechanic") or ("isolation" if len(p) + len(s) <= 2 else "compound")
            ex["how"] = [t.strip() for t in e.get("instructions") or [] if t.strip()]
            ex["img"] = len(e.get("images") or [])
            ex["src"] = e["name"]
        else:
            ex["mech"] = "isolation" if len(p) + len(s) <= 2 else "compound"
            ex["how"] = OWN_HOWTO.get(name, [])
            ex["img"] = 0
        if words:
            ex["words"] = words
        if ex["id"] in seen:
            problems.append(f"{name}: duplicate id {ex['id']}")
        seen.add(ex["id"])
        out.append(ex)
    if problems:
        print("\n".join(problems))
        sys.exit(1)
    by_hand = len(out)
    rest = []
    for e in src.values():
        if e["id"] in seen or e.get("category") not in AUTO_CATEGORIES or not e.get("primaryMuscles"):
            continue
        p, s = auto_zones(e)
        if not p:
            continue
        rest.append({
            "id": e["id"], "name": e["name"], "eq": EQ_FROM_SOURCE.get(e.get("equipment"), OT),
            "kind": PULL if p[0] == "delt_rear" else KIND_FROM_GROUP.get(e["primaryMuscles"][0], PULL), "p": p, "s": s, "group": group_of[p[0]],
            "mech": e.get("mechanic") or ("isolation" if len(p) + len(s) <= 2 else "compound"),
            "how": [t.strip() for t in e.get("instructions") or [] if t.strip()], "img": len(e.get("images") or []), "auto": 1,
        })
    order = {m[0]: i for i, m in enumerate(MUSCLES)}
    rest.sort(key=lambda x: (order[x["p"][0]], x["name"]))
    out.extend(rest)
    catalog = {
        "source": "free-exercise-db (public domain, github.com/yuhonas/free-exercise-db); zones mapped by hand, or by rule where marked auto, in tools/build_catalog.py",
        "imageBase": IMAGE_BASE,
        "groups": GROUPS,
        "muscles": [{"id": i, "name": n, "short": sh, "group": g, **({"note": MUSCLE_NOTES[i]} if i in MUSCLE_NOTES else {})} for i, n, sh, g in MUSCLES],
        "exercises": out,
    }
    dest = ROOT / "data" / "exercises.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(catalog, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    covered = {z for e in out for z in e["p"]}
    print(f"wrote {dest} · {len(out)} exercises ({by_hand} mapped by hand, {len(rest)} by rule) · {dest.stat().st_size // 1024} KB")
    missing = muscle_ids - covered
    if missing:
        print("zones with no direct exercise:", sorted(missing))
    by_group = {}
    for e in out:
        by_group[e["group"]] = by_group.get(e["group"], 0) + 1
    print(by_group)


if __name__ == "__main__":
    build()
