"""
Simple ML Model Training for Voice Agent
Trains a basic XGBoost model using the 4 fields collected: name, income, credit_score, loan_amount
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
import xgboost as xgb
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
    """Train XGBoost model"""
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
    
    # Train model
    print("\n🤖 Training XGBoost model...")
    model = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        random_state=42,
        eval_metric='logloss'
    )
    
    model.fit(X_train, y_train)
    
    # Evaluate
    train_score = model.score(X_train, y_train)
    test_score = model.score(X_test, y_test)
    
    print(f"\n📈 Model Performance:")
    print(f"Training Accuracy: {train_score:.4f}")
    print(f"Testing Accuracy: {test_score:.4f}")
    
    # Feature importance
    print(f"\n🎯 Feature Importance:")
    for feature, importance in zip(X.columns, model.feature_importances_):
        print(f"  {feature}: {importance:.4f}")
    
    # Save model
    model_dir = Path("app/models")
    model_dir.mkdir(parents=True, exist_ok=True)
    
    model_path = model_dir / "loan_model.pkl"
    with open(model_path, 'wb') as f:
        pickle.dump(model, f)
    
    # Save column names
    columns_path = model_dir / "X_columns.pkl"
    with open(columns_path, 'wb') as f:
        pickle.dump(list(X.columns), f)
    
    print(f"\n✅ Model saved to {model_path}")
    print(f"✅ Columns saved to {columns_path}")
    
    # Test prediction
    print(f"\n🧪 Testing prediction...")
    test_case = pd.DataFrame({
        'monthly_income': [5000],
        'credit_score': [720],
        'loan_amount': [50000]
    })
    
    prob = model.predict_proba(test_case)[0][1]
    print(f"Test case: Income=$5000, Credit=720, Loan=$50000")
    print(f"Predicted probability: {prob:.2%}")
    print(f"Result: {'✅ Eligible' if prob >= 0.5 else '❌ Ineligible'}")
    
    return model

if __name__ == "__main__":
    try:
        model = train_model()
        print("\n✅ Training completed successfully!")
        print("   Model is ready for use in the Voice Agent.")
    except Exception as e:
        print(f"\n❌ Error during training: {str(e)}")
        import traceback
        traceback.print_exc()
