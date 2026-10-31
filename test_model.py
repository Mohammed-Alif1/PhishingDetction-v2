
import pickle
import xgboost

print("XGBoost version:", xgboost.__version__)

with open("XGBoostClassifier.pickle.dat", "rb") as file:
    model = pickle.load(file)

print("Model loaded successfully!")
print("Model type:", type(model))
print("Expected features:", model.n_features_in_)
