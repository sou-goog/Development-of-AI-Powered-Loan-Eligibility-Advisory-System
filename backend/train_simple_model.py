"""
Simple ML Model Training for Voice Agent
Trains a basic XGBoost model using the 4 fields collected: name, income, credit_score, loan_amount
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
import xgboost as xgb
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
import pickle
from pathlib import Path

def create_synthetic_data(n_samples=1000):
    """Create synthetic loan data for training"""
    np.random.seed(42)
    
    data = {
        'monthly_income': np.random.uniform(3000, 15000, n_samples),
        'credit_score': np.random.randint(300, 850, n_samples),
        'loan_amount': np.random.uniform(5000, 100000, n_samples),
    }
    
    df = pd.DataFrame(data)
    
    # Create target based on simple rules
    df['eligible'] = (
        (df['credit_score'] >= 650) & 
        (df['monthly_income'] >= 4000) &
        (df['loan_amount'] / df['monthly_income'] < 20)
    ).astype(int)
    
    # Add some noise
    noise_indices = np.random.choice(n_samples, size=int(n_samples * 0.1), replace=False)
    df.loc[noise_indices, 'eligible'] = 1 - df.loc[noise_indices, 'eligible']
    
    return df

def train_model():
    """Train XGBoost, Decision Tree, and Random Forest models"""
    print("🏦 Training Simple Loan Model for Voice Agent")
    print("=" * 50)
    
    # Create synthetic data
    print("\n📊 Creating synthetic training data...")
    df = create_synthetic_data(1000)
    
    print(f"Dataset shape: {df.shape}")
    print(f"Eligible: {df['eligible'].sum()} ({df['eligible'].mean():.1%})")
    print(f"Ineligible: {(~df['eligible'].astype(bool)).sum()} ({(1-df['eligible'].mean()):.1%})")
    
    # Prepare features
    X = df[['monthly_income', 'credit_score', 'loan_amount']]
    y = df['eligible']
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    print(f"\nTraining set: {X_train.shape}, Test set: {X_test.shape}")
    
    # Train XGBoost
    print("\n🤖 Training XGBoost model...")
    xgb_model = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        random_state=42,
        eval_metric='logloss'
    )
    xgb_model.fit(X_train, y_train)
    xgb_train_score = xgb_model.score(X_train, y_train)
    xgb_test_score = xgb_model.score(X_test, y_test)

    # Train Decision Tree
    print("\n🌳 Training Decision Tree model...")
    dt_model = DecisionTreeClassifier(max_depth=5, random_state=42)
    dt_model.fit(X_train, y_train)
    dt_train_score = dt_model.score(X_train, y_train)
    dt_test_score = dt_model.score(X_test, y_test)

    # Train Random Forest
    print("\n🌲 Training Random Forest model...")
    rf_model = RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42)
    rf_model.fit(X_train, y_train)
    rf_train_score = rf_model.score(X_train, y_train)
    rf_test_score = rf_model.score(X_test, y_test)

    print(f"\n📈 Model Performance:")
    print(f"XGBoost - Training: {xgb_train_score:.4f}, Testing: {xgb_test_score:.4f}")
    print(f"Decision Tree - Training: {dt_train_score:.4f}, Testing: {dt_test_score:.4f}")
    print(f"Random Forest - Training: {rf_train_score:.4f}, Testing: {rf_test_score:.4f}")

    # Save models
    model_dir = Path("app/models")
    model_dir.mkdir(parents=True, exist_ok=True)

    with open(model_dir / "loan_xgboost_model.pkl", 'wb') as f:
        pickle.dump(xgb_model, f)
    with open(model_dir / "loan_decision_tree_model.pkl", 'wb') as f:
        pickle.dump(dt_model, f)
    with open(model_dir / "loan_random_forest_model.pkl", 'wb') as f:
        pickle.dump(rf_model, f)

    # Save column names
    columns_path = model_dir / "X_columns.pkl"
    with open(columns_path, 'wb') as f:
        pickle.dump(list(X.columns), f)

    # Save accuracies for reference
    accuracies = {
        "xgboost": {"train": xgb_train_score, "test": xgb_test_score},
        "decision_tree": {"train": dt_train_score, "test": dt_test_score},
        "random_forest": {"train": rf_train_score, "test": rf_test_score},
    }
    with open(model_dir / "model_accuracies.pkl", 'wb') as f:
        pickle.dump(accuracies, f)

    print(f"\n✅ Models saved to {model_dir}")
    print(f"✅ Columns saved to {columns_path}")
    print(f"✅ Accuracies saved to {model_dir / 'model_accuracies.pkl'}")

    # Test prediction
    print(f"\n🧪 Testing prediction...")
    test_case = pd.DataFrame({
        'monthly_income': [5000],
        'credit_score': [720],
        'loan_amount': [50000]
    })
    for name, model in zip([
        "XGBoost", "Decision Tree", "Random Forest"
    ], [xgb_model, dt_model, rf_model]):
        prob = model.predict_proba(test_case)[0][1]
        print(f"{name} - Predicted probability: {prob:.2%} | Result: {'✅ Eligible' if prob >= 0.5 else '❌ Ineligible'}")

    return xgb_model, dt_model, rf_model

if __name__ == "__main__":
    try:
        model = train_model()
        print("\n✅ Training completed successfully!")
        print("   Model is ready for use in the Voice Agent.")
    except Exception as e:
        print(f"\n❌ Error during training: {str(e)}")
        import traceback
        traceback.print_exc()
