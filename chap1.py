# Import libraries
import sympy as sp
from sympy import symbols, Eq, solve
import matplotlib.pyplot as plt
import numpy as np

# Define variables
x, y = symbols('x y')

# Define equation
eq1 = Eq(x-y-4,0)
eq2 = Eq(x**2+y**2-x-y-20,0)

# Solve the equation
sol_dict = solve((eq1, eq2), (x, y))

# Print the answer
print(sol_dict)

# Plot the equations
sp.plot_implicit(eq1, (x,-8,8), (y,-8,8), line_color='red', show=False)
sp.plot_implicit(eq2, (x,-8,8), (y,-8,8), line_color='blue', show=True)


