from setuptools import setup, find_packages

setup(
    name="assessment-data-mcp",
    version="0.8.0",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    python_requires=">=3.10",
)
