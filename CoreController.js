import { Op } from "sequelize";

/**
This is Default Controller that impletemented sequelize model filter
  * ordering
  * filtering
  * nestedObject filter.
  * pagination

TODO: create validation
e.g)

class A extends CoreController
const models from "../db/models";


const searchFields = [];

const filteredFields = [];

const orderingFields = [];
const nestedFields = {
  [B.model.name]: B, // set declared other Controller
};

export default A(
  models.B,
  null,
  searchFields,
  filteredFields,
  orderingFields,
  nestedFields
)
**/
export class CoreController {
  constructor(
    model,
    validator, // Not Implemented Yet
    searchFields = [],
    filterFields = [],
    orderingFields = [],
    nestedFields = {}
  ) {
    this.model = model;
    this.validator = validator;
    this.searchFields = searchFields;
    this.filterFields = filterFields;
    this.orderingFields = orderingFields;
    this.nestedFields = nestedFields;
  }

  async findByPk(id, options = {}) {
    return this.model.findByPk(id, options);
  }

  filtered(options = {}) {
    const where = {};
    let orCond = [];
    let andCond = {};
    if (options.search) {
      orCond = this.searchFields.reduce((pre, cur) => {
        pre.push({
          [cur]: {
            [Op.like]: `%${options.search}%`,
          },
        });
        return pre;
      }, []);
    }
    andCond = Object.keys(options)
      .filter((key) => !!options[key])
      .filter((key) => this.filterFields.includes(key.split("__")[0]))
      .reduce((pre, key) => {
        const [keyName, operator] = key.split("__");
        let value = options[key];
        if (operator && Op[operator]) {
          if (["in", "notIn"].includes(operator) && value) {
            value = value.split(",");
          }
          pre[keyName] = {
            ...pre[keyName],
            [Op[operator]]: value,
          };
        } else {
          pre[keyName] = value;
        }
        return pre;
      }, {});

    if (Object.keys(andCond).length) {
      where[Op.and] = [andCond];
    }

    if (orCond.length) {
      where[Op.or] = orCond;
    }
    return where;
  }

  nested(params = {}, options = {}, prefix = "") {
    let append = prefix;
    if (options.model) {
      const modelName = options.model.name;
      const Ctrl = this.nestedFields[options.model.name];
      if (Ctrl) {
        append += `${modelName}__`;
        const nestedParam = Object.keys(params)
          .filter((key) => key.startsWith(append))
          .reduce((pre, key) => {
            const value = params[key];
            const field = key.split(append).pop();
            pre[field] = value;
            return pre;
          }, {});
        options.where = Ctrl.filtered(nestedParam);
      }
    }

    if (!options.include) {
      return options;
    }

    options.include = options.include.map((include) => {
      options.include = this.nested(params, include, append);
      return include;
    });
    return options;
  }

  ordered(options = {}) {
    let order = [];
    if (options.ordering) {
      order = options.ordering
        .split(",")
        .map((orderField) => {
          if (orderField[0] === "-") {
            return [orderField.slice(1), "DESC"];
          }
          return [orderField, "ASC"];
        })
        .filter((field) => this.orderingFields.indexOf(field[0]) !== -1);
    }
    return order;
  }

  async paginated(options = {}) {
    const { offset, limit } = options;
    return {
      offset,
      limit,
    };
  }

  async list(params = {}, options = {}) {
    const where = this.filtered(params);
    const order = this.ordered(params);
    const page = this.paginated(params);
    return await this.model.findAndCountAll({
      ...this.nested(params, options),
      where,
      order,
      ...page,
    });
  }

  async findOne(params, options = {}) {
    const where = this.filtered(params);
    return await this.model.findOne({
      ...options,
      where,
    });
  }
}

export default CoreController;
