// @flow
import { normalize, Schema, arrayOf } from 'normalizr';
import { isArray } from 'lodash';

import callApi from '../services/api';

const processEntity = (schema: typeof Schema, result: { entities: Object | Array }) => {
  const usedSchema = isArray(result.entities) ? arrayOf(schema) : schema;
  const normalizedResult = normalize(result, usedSchema);
  return { entity: result, ...normalizedResult };
};

export const getEntity = async (
  url: string,
  schema: typeof Schema,
  body: ?Object,
  options: Object = {},
) => {
  const result = await callApi(url, { body, ...options });
  return processEntity(schema, result.data);
};

export const getKeys = (key: string) => {
  const KEY = key.toUpperCase();
  const keys = {
    getSingle: `REQUEST_SINGLE_${KEY}`,
    update: `UPDATE_SINGLE_${KEY}`,
    create: `CREATE_SINGLE_${KEY}`,
    delete: `DELETE_SINGLE_${KEY}`,
  };

  return Object.keys(keys).reduce((prev, next) => ({
    ...prev,
    [next]: {
      request: keys[next],
      failure: `${keys[next]}_FAILURE`,
      success: `${keys[next]}_SUCCESS`,
    },
  }), {});
};

export default (schema: typeof Schema) => {
  const key = schema.getKey();
  const actionKeys = getKeys(key);
  return {
    getById: (id: string, body: ?Object = null) => async (dispatch: Function) => {
      const keys = actionKeys.getSingle;
      dispatch({ type: keys.request, id });
      const normalizedResult = await getEntity(`${key}/${id}`, schema, body);
      return dispatch({ type: keys.success, id, ...normalizedResult });
    },

    create: (data: Object) => async (dispatch: Function) => {
      const keys = actionKeys.create;
      dispatch({ type: keys.request, data });

      try {
        const response = await callApi(`${key}/`, {
          method: 'POST',
          body: { data },
        });
        const entity = response.data;

        dispatch({ type: keys.success, entity });

        return entity;
      } catch (e) {
        dispatch({ type: keys.failure, error: e });
        console.error(e);
        throw e;
      }
    },

    updateById: (id: string, oldData: Object, newData: Object, updateFields: Array<string> = []) =>
    async (dispatch: Function) => {
      const keys = actionKeys.update;
      dispatch({ type: keys.request, id, newData });

      try {
        await callApi(`${key}/${id}`, {
          method: 'PATCH',
          body: { data: newData },
        });

        dispatch({ type: keys.success, id, newData, updateFields });
      } catch (e) {
        dispatch({ type: keys.failure, id, oldData, error: e });
        console.error(e);
        throw e;
      }
    },

    delete: (id: string) => async (dispatch: Function, getState: Function) => {
      const keys = actionKeys.delete;

      const entityData = getState().entities[key][id];
      dispatch({ type: keys.request, id });

      try {
        await callApi(`${key}/${id}`, {
          method: 'DELETE',
        });

        dispatch({ type: keys.success, id });
      } catch (e) {
        dispatch({ type: keys.failure, id, entity: entityData });
        console.error(e);
        throw e;
      }
    },
  };
};
