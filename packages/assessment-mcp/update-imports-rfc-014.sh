#!/bin/bash
# RFC-014 Import Update Script
# Updates all import paths after file restructuring

set -e

echo "🔧 Updating import paths..."
echo ""

# Function to update imports in a file
update_imports() {
    local file="$1"
    if [ ! -f "$file" ]; then
        return
    fi
    
    echo "  → $file"
    
    # Reflection tools imports
    sed -i.bak "s|from '../core/aspect_analyzer'|from '../reflection/aspect_analyzer'|g" "$file"
    sed -i.bak "s|from '../core/insights_writer'|from '../reflection/insights_writer'|g" "$file"
    sed -i.bak "s|from '../core/reflect_uncertainty'|from '../reflection/uncertainty_reviewer'|g" "$file"
    sed -i.bak "s|from './aspect_analyzer'|from '../reflection/aspect_analyzer'|g" "$file"
    sed -i.bak "s|from './insights_writer'|from '../reflection/insights_writer'|g" "$file"
    sed -i.bak "s|from './reflect_uncertainty'|from '../reflection/uncertainty_reviewer'|g" "$file"
    
    # Shared utilities imports
    sed -i.bak "s|from '../core/exam_config_reader'|from '../shared/exam_config_reader'|g" "$file"
    sed -i.bak "s|from '../core/rubric_parser'|from '../shared/rubric_parser'|g" "$file"
    sed -i.bak "s|from '../core/project_state_manager'|from '../shared/project_state_manager'|g" "$file"
    sed -i.bak "s|from '../core/yaml_generator'|from '../shared/yaml_generator'|g" "$file"
    sed -i.bak "s|from './exam_config_reader'|from '../shared/exam_config_reader'|g" "$file"
    sed -i.bak "s|from './rubric_parser'|from '../shared/rubric_parser'|g" "$file"
    sed -i.bak "s|from './project_state_manager'|from '../shared/project_state_manager'|g" "$file"
    sed -i.bak "s|from './yaml_generator'|from '../shared/yaml_generator'|g" "$file"
    
    # Also update class name for renamed file
    sed -i.bak "s|ReflectUncertainty|UncertaintyReviewer|g" "$file"
    
    # Remove backup file
    rm -f "$file.bak"
}

# Update tools
echo "📦 Updating src/tools/..."
for file in src/tools/*.ts; do
    update_imports "$file"
done

# Update core files
echo "📦 Updating src/core/..."
for file in src/core/*.ts; do
    update_imports "$file"
done

# Update reflection files (in case they import each other)
echo "📦 Updating src/reflection/..."
for file in src/reflection/*.ts; do
    update_imports "$file"
done

# Update shared files (in case they import each other)
echo "📦 Updating src/shared/..."
for file in src/shared/*.ts; do
    update_imports "$file"
done

# Update test files
echo "📦 Updating tests/..."
if [ -d "tests" ]; then
    find tests -name "*.ts" -type f | while read file; do
        update_imports "$file"
    done
fi

# Update __tests__ files
if [ -d "src/__tests__" ]; then
    find src/__tests__ -name "*.ts" -type f | while read file; do
        update_imports "$file"
    done
fi

echo ""
echo "✅ Import paths updated!"
echo ""
echo "📝 Next steps:"
echo "   1. Review changes: git diff"
echo "   2. Run: npm test"
echo "   3. Run: npm run build"
echo "   4. Run: npm run typecheck"
