from predict import predict_sic
prediction = predict_sic(
    location_id=0,
    y_index=206,
    x_index=308,
    x=3762500,
    y=-812500,
    sic_lag_1=0.8,
    sic_lag_2=0.75,
    sic_lag_3=0.82,
    sic_lag_7=0.78,
    sic_lag_14=0.70,
    sic_lag_30=0.65,
    day_of_year=180,
    month=6
)
print("Predicted SIC:", prediction)
print("Predicted percentage:", prediction * 100, "%")